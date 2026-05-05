/**
 * =====================================================
 *  INCOME EXCEL PARSER - 소득신고 정산서 전용 파서
 *  핵심 수정: 쿠팡 정산서의 다중 헤더 행 처리
 * =====================================================
 */
const IncomeExcelParser = {

    // 한글 NFC/NFD 정규화 + 공백 제거
    _norm(str) {
        return (str || '').toString().normalize('NFC').replace(/\s/g, '').trim();
    },

    _parseAmount(val) {
        if (!val && val !== 0) return 0;
        const str = val.toString().replace(/,/g, '').replace(/[원\s]/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : Math.round(num);
    },

    /**
     * 배민 주정산서 파싱
     * 시트: "을지_협력사_소속_라이더정산_확인용"
     * 컬럼: 라이더명, user ID, 라이더별정산금액
     */
    async parseBaemin(file, riders) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });

                    // ★ 시트 선택: 우선순위 기반 (가장 구체적인 이름 우선)
                    // 최후 수단: 모든 시트를 스캔하여 "라이더명" 헤더가 실제로 있는 시트 탐색
                    const _norm = (s) => (s||'').toString().normalize('NFC').replace(/\s/g,'').trim();

                    let sheetName =
                        // 1순위: "라이더정산" + "확인" 둘 다 포함
                        wb.SheetNames.find(n => n.includes('라이더정산') && n.includes('확인')) ||
                        // 2순위: "소속" + "협력사" 둘 다 포함
                        wb.SheetNames.find(n => n.includes('소속') && n.includes('협력사')) ||
                        // 3순위: "을지" 포함 (단독)
                        wb.SheetNames.find(n => n.includes('을지')) ||
                        // 4순위: 모든 시트 스캔 → "라이더명" 헤더가 실제로 있는 시트
                        wb.SheetNames.find(n => {
                            const ws2 = wb.Sheets[n];
                            const raw = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
                            return raw.slice(0, 50).some(row =>
                                row.map(c => _norm(String(c))).some(c => c.includes('라이더명'))
                            );
                        });

                    if (!sheetName) {
                        reject(new Error(
                            `배민 정산 시트를 찾을 수 없습니다.\n` +
                            `찾는 시트: "을지_협력사_소속_라이더정산_확인용"\n` +
                            `발견된 시트: ${wb.SheetNames.join(', ')}`
                        ));
                        return;
                    }

                    const ws = wb.Sheets[sheetName];

                    // ★ raw 2D 배열로 읽기 (다중 헤더 행 대응)
                    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                    // ★ 헤더 행 탐색: "라이더명" 또는 "user" 포함 행 스캔
                    let headerRowIdx = -1;
                    let nameColIdx   = -1;
                    let idColIdx     = -1;
                    let amountColIdx = -1;

                    for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
                        const normRow = rawRows[i].map(c => this._norm(String(c)));

                        const ni = normRow.findIndex(c =>
                            c === '라이더명' || c.includes('라이더명')
                        );
                        if (ni !== -1) {
                            // 같은 행에서 user ID 컬럼 찾기
                            const ii = normRow.findIndex(c =>
                                c.toLowerCase() === 'userid' ||
                                c.toLowerCase().includes('userid') ||
                                c.toLowerCase().includes('user')
                            );
                            // 같은 행에서 금액 컬럼 찾기
                            const ai = normRow.findIndex(c =>
                                c.includes('라이더별정산금액') || c.includes('정산금액') ||
                                (c.includes('정산') && c.includes('액'))
                            );

                            headerRowIdx = i;
                            nameColIdx   = ni;
                            idColIdx     = ii;
                            amountColIdx = ai;
                            break;
                        }
                    }

                    if (headerRowIdx === -1) {
                        reject(new Error(
                            `배민 정산 시트에서 "라이더명" 컬럼을 찾을 수 없습니다.\n` +
                            `시트: ${sheetName}\n` +
                            `첫 5행 샘플: ${rawRows.slice(0, 5).map(r => r.slice(0, 6).join('|')).join(' / ')}`
                        ));
                        return;
                    }

                    const debugMsg = `시트: ${sheetName} | 헤더행: ${headerRowIdx + 1}번째 | 라이더명열: ${nameColIdx} | ID열: ${idColIdx} | 금액열: ${amountColIdx}`;

                    const matched = [], unmatched = [];
                    const dataRows = rawRows.slice(headerRowIdx + 1);

                    dataRows.forEach((row) => {
                        const riderName = this._norm(row[nameColIdx] || '');
                        const userId    = this._norm(row[idColIdx]   || '');
                        const amount    = this._parseAmount(amountColIdx !== -1 ? row[amountColIdx] : 0);

                        if ((!riderName && !userId) || amount <= 0) return;

                        let rider = null;
                        // 1단계: 배민ID 매칭
                        if (userId) {
                            rider = riders.find(r =>
                                r.baeminId && r.baeminId.trim().toLowerCase() === userId.toLowerCase()
                            );
                        }
                        // 2단계: 이름 매칭 (유니코드 정규화)
                        if (!rider && riderName) {
                            rider = riders.find(r => this._norm(r.name) === riderName);
                        }

                        if (rider) {
                            matched.push({ riderId: rider.id, name: rider.name, baeminId: userId, amount });
                        } else {
                            unmatched.push({ name: riderName, baeminId: userId, amount });
                        }
                    });

                    resolve({ matched, unmatched, sheetName, debug: debugMsg });

                } catch (err) { reject(err); }
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    },

    _parseBaeminRows(rows, riders, sheetName, resolve) {
        if (rows.length === 0) { resolve({ matched: [], unmatched: [], sheetName }); return; }
        const keys = Object.keys(rows[0]);
        const nameKey   = keys.find(k => k.includes('라이더명')) || '라이더명';
        const idKey     = keys.find(k => k.toLowerCase().includes('user')) || 'user ID';
        const amountKey = keys.find(k => k.includes('정산금액') || k.includes('지급액')) || '라이더별정산금액';
        const matched = [], unmatched = [];
        rows.forEach(row => {
            const riderName = this._norm(row[nameKey] || '');
            const userId    = this._norm(row[idKey] || '');
            const amount    = this._parseAmount(row[amountKey] || 0);
            if ((!riderName && !userId) || amount <= 0) return;
            let rider = null;
            if (userId) rider = riders.find(r => r.baeminId && r.baeminId.trim().toLowerCase() === userId.toLowerCase());
            if (!rider && riderName) rider = riders.find(r => this._norm(r.name) === riderName);
            if (rider) matched.push({ riderId: rider.id, name: rider.name, baeminId: userId, amount });
            else unmatched.push({ name: riderName, baeminId: userId, amount });
        });
        resolve({ matched, unmatched, sheetName });
    },

    /**
     * 쿠팡 주정산서 파싱
     * 시트: "종합"
     * 컬럼: 성함 (홍길동1234 형식), 라이더별실지급액
     *
     * ★ 핵심 수정: 원시 배열로 파싱 후 "성함" 포함 행을 헤더로 직접 탐색
     *   (쿠팡 정산서는 상단에 타이틀/병합 행이 여러 줄 있어 기본 파싱 불가)
     */
    async parseCoupang(file, riders) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });

                    const sheetName = wb.SheetNames.find(n => n.includes('종합'));
                    if (!sheetName) {
                        reject(new Error(
                            `쿠팡 정산 시트를 찾을 수 없습니다.\n` +
                            `찾는 시트: "종합"\n` +
                            `발견된 시트: ${wb.SheetNames.join(', ')}`
                        ));
                        return;
                    }

                    const ws = wb.Sheets[sheetName];

                    // ★ 원시 2D 배열로 읽기 (병합 셀/다중 헤더 대응)
                    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                    // ★ 헤더 행 탐색: "성함" 또는 "이름" 포함 행을 찾을 때까지 스캔
                    let headerRowIdx = -1;
                    let nameColIdx   = -1;
                    let amountColIdx = -1;

                    for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
                        const row = rawRows[i];
                        const normRow = row.map(c => this._norm(String(c)));

                        const ni = normRow.findIndex(c =>
                            c === '성함' || c === '이름' || c === '성명' || c.includes('성함')
                        );
                        if (ni !== -1) {
                            // 같은 행에서 금액 컬럼도 찾기
                            const ai = normRow.findIndex(c =>
                                c.includes('실지급액') || c.includes('라이더별') ||
                                (c.includes('지급') && c.includes('액'))
                            );
                            headerRowIdx = i;
                            nameColIdx   = ni;
                            amountColIdx = ai !== -1 ? ai : -1;
                            break;
                        }
                    }

                    // 금액 컬럼을 헤더 행에서 못 찾은 경우 → 다음 행들에서 추가 탐색
                    if (headerRowIdx !== -1 && amountColIdx === -1) {
                        // 헤더가 2행으로 나뉜 경우 대비: 다음 행도 확인
                        const nextRow = rawRows[headerRowIdx + 1] || [];
                        const normNext = nextRow.map(c => this._norm(String(c)));
                        amountColIdx = normNext.findIndex(c =>
                            c.includes('실지급액') || c.includes('라이더별') ||
                            (c.includes('지급') && c.includes('액'))
                        );
                    }

                    if (headerRowIdx === -1) {
                        reject(new Error(
                            `"종합" 시트에서 "성함" 컬럼을 찾을 수 없습니다.\n` +
                            `첫 30행 내용: ${rawRows.slice(0, 5).map(r => r.slice(0, 5).join('|')).join(' / ')}`
                        ));
                        return;
                    }

                    const debugMsg = `시트: ${sheetName} | 헤더행: ${headerRowIdx + 1}번째 | 성함열: ${nameColIdx} | 금액열: ${amountColIdx}`;

                    const matched = [], unmatched = [];
                    const dataRows = rawRows.slice(headerRowIdx + 1);

                    dataRows.forEach((row) => {
                        const seongham = this._norm(row[nameColIdx] || '');
                        const amountRaw = amountColIdx !== -1 ? row[amountColIdx] : 0;
                        const amount = this._parseAmount(amountRaw);

                        if (!seongham || amount <= 0) return;

                        // "홍길동1234" → 이름 + 뒷번호 분리
                        const m = seongham.match(/^(.+?)(\d{4})$/);
                        let riderName = seongham;
                        let last4 = '';
                        if (m) {
                            riderName = this._norm(m[1]);
                            last4 = m[2];
                        }

                        // 3단계 매칭
                        let rider = null;

                        // 1단계: 이름 + 쿠팡뒷번호
                        if (last4) {
                            rider = riders.find(r =>
                                this._norm(r.name) === riderName &&
                                (r.coupangLast4 || '').trim() === last4
                            );
                        }
                        // 2단계: 쿠팡뒷번호만 (이름 인코딩 차이 보정)
                        if (!rider && last4) {
                            rider = riders.find(r => (r.coupangLast4 || '').trim() === last4);
                        }
                        // 3단계: 정규화 이름만
                        if (!rider && riderName) {
                            rider = riders.find(r => this._norm(r.name) === riderName);
                        }

                        if (rider) {
                            matched.push({ riderId: rider.id, name: rider.name, rawName: seongham, amount });
                        } else {
                            unmatched.push({ rawName: seongham, name: riderName, last4, amount });
                        }
                    });

                    resolve({ matched, unmatched, sheetName, debug: debugMsg });

                } catch (err) { reject(err); }
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * 라이더 일괄 등록용 엑셀 파싱
     */
    async parseRiderBulk(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                    const riders = rows.map(row => ({
                        name:         (row['이름'] || row['성명'] || '').toString().trim(),
                        phone:        (row['전화번호'] || row['휴대폰'] || row['연락처'] || '').toString().trim(),
                        residentNo:   (row['주민번호'] || row['주민등록번호'] || '').toString().trim(),
                        baeminId:     (row['배민ID'] || row['배민아이디'] || row['배민 ID'] || '').toString().trim(),
                        coupangLast4: (row['쿠팡뒷번호'] || row['쿠팡 뒷번호'] || row['쿠팡뒷자리'] || '').toString().trim(),
                    })).filter(r => r.name && r.phone);
                    resolve(riders);
                } catch (err) { reject(err); }
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    },

    downloadRiderTemplate() {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([
            { '이름': '홍길동', '전화번호': '010-1234-5678', '주민번호': '900101-1234567', '배민ID': 'hong123', '쿠팡뒷번호': '5678' },
            { '이름': '김라이더', '전화번호': '010-9876-5432', '주민번호': '850601-2345678', '배민ID': 'kimrider99', '쿠팡뒷번호': '5432' }
        ]);
        ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, '라이더등록양식');
        XLSX.writeFile(wb, '라이더_등록_양식.xlsx');
    },

    downloadSummaryExcel(summaryRows, weekLabels) {
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(summaryRows.map((r, idx) => ({
            '번호': idx + 1, '이름': r.name, '전화번호': r.phone, '주민번호': r.residentNo,
            '배민ID': r.baeminId, '쿠팡뒷번호': r.coupangLast4,
            '배민 수입 합계(원)': r.baemin, '쿠팡 수입 합계(원)': r.coupang, '총 수입 합계(원)': r.total
        })));
        ws1['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws1, '라이더별_수입_요약');

        const batchData = [];
        incomeDb.getSettlements().forEach(b => {
            b.records.forEach(rec => {
                batchData.push({
                    '업로드ID': b.batchId, '플랫폼': b.platform === 'baemin' ? '배달의민족' : '쿠팡이츠',
                    '주차': b.weekLabel, '업로드일시': new Date(b.uploadedAt).toLocaleString('ko-KR'),
                    '라이더명': rec.name, '금액(원)': rec.amount
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(batchData), '업로드_원본_내역');

        const today = new Date().toISOString().slice(0, 10);
        const periodStr = weekLabels && weekLabels.length > 0
            ? `_${weekLabels[weekLabels.length - 1]}~${weekLabels[0]}` : '';
        XLSX.writeFile(wb, `라이더_소득_정산${periodStr}_${today}.xlsx`);
    }
};
