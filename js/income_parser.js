/**
 * =====================================================
 *  INCOME EXCEL PARSER - 소득신고 정산서 전용 파서
 *  배민/쿠팡 주정산서를 파싱하여 라이더별 금액을 추출
 * =====================================================
 */
const IncomeExcelParser = {

    /**
     * 배민 주정산서 파싱
     * 시트: "을지_협력사_소속_라이더정산_확인용"
     * 컬럼: 라이더명, user ID, 라이더별정산금액
     * @param {File} file
     * @param {Array} riders - incomeDb.getRiders()
     * @returns {Promise<{matched: [], unmatched: []}>}
     */
    async parseBaemin(file, riders) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });

                    // 시트 찾기 (부분 일치)
                    const sheetName = wb.SheetNames.find(n =>
                        n.includes('을지') || n.includes('라이더정산') || n.includes('협력사')
                    );
                    if (!sheetName) {
                        reject(new Error(
                            `배민 정산 시트를 찾을 수 없습니다.\n` +
                            `찾는 시트: "을지_협력사_소속_라이더정산_확인용"\n` +
                            `발견된 시트: ${wb.SheetNames.join(', ')}`
                        ));
                        return;
                    }

                    const ws = wb.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

                    const matched = [];
                    const unmatched = [];

                    rows.forEach((row, idx) => {
                        // 컬럼명 유연 매칭
                        const riderName = (row['라이더명'] || row['라이더 명'] || '').toString().trim();
                        const userId = (row['user ID'] || row['userID'] || row['User ID'] || row['아이디'] || '').toString().trim();
                        const amountRaw = row['라이더별정산금액'] || row['정산금액'] || row['지급액'] || 0;
                        const amount = this._parseAmount(amountRaw);

                        if (!riderName && !userId) return; // 빈 행 스킵
                        if (amount === 0) return; // 금액 없는 행 스킵

                        // 라이더 매칭: 이름 + 배민ID 모두 시도
                        let rider = null;
                        if (userId) {
                            rider = riders.find(r =>
                                r.baeminId && r.baeminId.trim().toLowerCase() === userId.toLowerCase()
                            );
                        }
                        if (!rider && riderName) {
                            rider = riders.find(r =>
                                r.name.trim() === riderName
                            );
                        }

                        if (rider) {
                            matched.push({
                                riderId: rider.id,
                                name: rider.name,
                                baeminId: userId,
                                amount
                            });
                        } else {
                            unmatched.push({ name: riderName, baeminId: userId, amount });
                        }
                    });

                    resolve({ matched, unmatched, sheetName });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * 쿠팡 주정산서 파싱
     * 시트: "종합"
     * 컬럼: 성함 (홍길동1234 형식), 라이더별실지급액
     * @param {File} file
     * @param {Array} riders - incomeDb.getRiders()
     */
    async parseCoupang(file, riders) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });

                    // 시트 찾기 (부분 일치)
                    const sheetName = wb.SheetNames.find(n =>
                        n.includes('종합') || n === '종합'
                    );
                    if (!sheetName) {
                        reject(new Error(
                            `쿠팡 정산 시트를 찾을 수 없습니다.\n` +
                            `찾는 시트: "종합"\n` +
                            `발견된 시트: ${wb.SheetNames.join(', ')}`
                        ));
                        return;
                    }

                    const ws = wb.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

                    const matched = [];
                    const unmatched = [];

                    rows.forEach((row) => {
                        // 성함 컬럼: "홍길동1234" 형식
                        const seongham = (row['성함'] || row['이름'] || '').toString().trim();
                        const amountRaw = row['라이더별실지급액'] || row['실지급액'] || row['지급액'] || 0;
                        const amount = this._parseAmount(amountRaw);

                        if (!seongham || amount === 0) return;

                        // "홍길동1234" → 이름 + 뒷번호 분리
                        // 이름은 한글, 뒷번호는 마지막 숫자 4자리
                        const match = seongham.match(/^(.+?)(\d{4})$/);
                        let riderName = seongham;
                        let last4 = '';

                        if (match) {
                            riderName = match[1].trim();
                            last4 = match[2];
                        }

                        // 라이더 매칭: 이름 + 쿠팡뒷번호
                        let rider = null;
                        if (last4) {
                            rider = riders.find(r =>
                                r.name.trim() === riderName &&
                                r.coupangLast4.trim() === last4
                            );
                        }
                        if (!rider && riderName) {
                            // 이름만으로 시도
                            rider = riders.find(r => r.name.trim() === riderName);
                        }

                        if (rider) {
                            matched.push({
                                riderId: rider.id,
                                name: rider.name,
                                rawName: seongham,
                                amount
                            });
                        } else {
                            unmatched.push({ rawName: seongham, name: riderName, last4, amount });
                        }
                    });

                    resolve({ matched, unmatched, sheetName });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * 라이더 일괄 등록용 엑셀 파싱
     * 컬럼: 이름, 전화번호, 주민번호, 배민ID, 쿠팡뒷번호
     */
    async parseRiderBulk(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

                    const riders = [];
                    rows.forEach((row, idx) => {
                        const name = (row['이름'] || row['성명'] || '').toString().trim();
                        const phone = (row['전화번호'] || row['휴대폰'] || row['연락처'] || '').toString().trim();
                        const residentNo = (row['주민번호'] || row['주민등록번호'] || '').toString().trim();
                        const baeminId = (row['배민ID'] || row['배민아이디'] || row['배민 ID'] || '').toString().trim();
                        const coupangLast4 = (row['쿠팡뒷번호'] || row['쿠팡 뒷번호'] || row['쿠팡뒷자리'] || '').toString().trim();

                        if (!name || !phone) return; // 필수 필드 없으면 스킵
                        riders.push({ name, phone, residentNo, baeminId, coupangLast4 });
                    });

                    resolve(riders);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * 라이더 등록 양식 엑셀 다운로드
     */
    downloadRiderTemplate() {
        const wb = XLSX.utils.book_new();
        const templateData = [
            {
                '이름': '홍길동',
                '전화번호': '010-1234-5678',
                '주민번호': '900101-1234567',
                '배민ID': 'hong123',
                '쿠팡뒷번호': '5678'
            },
            {
                '이름': '김라이더',
                '전화번호': '010-9876-5432',
                '주민번호': '850601-2345678',
                '배민ID': 'kimrider99',
                '쿠팡뒷번호': '5432'
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);

        // 열 너비 설정
        ws['!cols'] = [
            { wch: 12 }, // 이름
            { wch: 18 }, // 전화번호
            { wch: 20 }, // 주민번호
            { wch: 18 }, // 배민ID
            { wch: 14 }, // 쿠팡뒷번호
        ];

        XLSX.utils.book_append_sheet(wb, ws, '라이더등록양식');
        XLSX.writeFile(wb, '라이더_등록_양식.xlsx');
    },

    /**
     * 라이더별 정산 집계 엑셀 다운로드
     */
    downloadSummaryExcel(summaryRows, weekLabels) {
        const wb = XLSX.utils.book_new();

        // 시트 1: 요약
        const summaryData = summaryRows.map((r, idx) => ({
            '번호': idx + 1,
            '이름': r.name,
            '전화번호': r.phone,
            '주민번호': r.residentNo,
            '배민ID': r.baeminId,
            '쿠팡뒷번호': r.coupangLast4,
            '배민 수입 합계(원)': r.baemin,
            '쿠팡 수입 합계(원)': r.coupang,
            '총 수입 합계(원)': r.total
        }));

        const ws1 = XLSX.utils.json_to_sheet(summaryData);
        ws1['!cols'] = [
            { wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 20 },
            { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
        ];
        XLSX.utils.book_append_sheet(wb, ws1, '라이더별_수입_요약');

        // 시트 2: 원본 정산 배치 목록
        const settlements = incomeDb.getSettlements();
        const batchData = [];
        settlements.forEach(b => {
            b.records.forEach(rec => {
                batchData.push({
                    '업로드ID': b.batchId,
                    '플랫폼': b.platform === 'baemin' ? '배달의민족' : '쿠팡이츠',
                    '주차': b.weekLabel,
                    '업로드일시': new Date(b.uploadedAt).toLocaleString('ko-KR'),
                    '라이더명': rec.name,
                    '금액(원)': rec.amount
                });
            });
        });
        const ws2 = XLSX.utils.json_to_sheet(batchData);
        XLSX.utils.book_append_sheet(wb, ws2, '업로드_원본_내역');

        const today = new Date().toISOString().slice(0, 10);
        const periodStr = weekLabels && weekLabels.length > 0
            ? `_${weekLabels[weekLabels.length - 1]}~${weekLabels[0]}`
            : '';
        XLSX.writeFile(wb, `라이더_소득_정산${periodStr}_${today}.xlsx`);
    },

    // ── 유틸 ────────────────────────────────────────────

    _parseAmount(val) {
        if (!val && val !== 0) return 0;
        const str = val.toString().replace(/,/g, '').replace(/원/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : Math.round(num);
    }
};
