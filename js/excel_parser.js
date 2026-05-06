const ExcelParser = {
    /**
     * Process multiple uploaded Excel files
     * @param {FileList|Array} files - Uploaded File objects
     * @param {string} platform - 'baemin' | 'coupang'
     * @param {Array} activeMembers - List of active members from DB (for current guild)
     * @returns {Promise<Object>} Aggregated results of parsing
     */
    async parseMultipleFiles(files, platform, activeMembers) {
        let totalRows = 0;
        let totalMatched = 0;
        let totalUnmatched = 0;
        let allUnmatchedSamples = [];
        let memberDeliveries = {}; // { memberId: count }

        for (let i = 0; i < files.length; i++) {
            const result = await this.parseSingleFile(files[i], platform, activeMembers);
            totalRows += result.totalRowsProcessed;
            totalMatched += result.matchedDeliveries;
            totalUnmatched += result.unmatchedCount;
            allUnmatchedSamples = allUnmatchedSamples.concat(result.unmatchedSamples);
            
            // Merge member deliveries
            for (const [memberId, count] of Object.entries(result.memberDeliveries)) {
                memberDeliveries[memberId] = (memberDeliveries[memberId] || 0) + count;
            }
        }

        return {
            success: true,
            totalRowsProcessed: totalRows,
            matchedDeliveries: totalMatched,
            unmatchedCount: totalUnmatched,
            unmatchedSamples: allUnmatchedSamples.slice(0, 10),
            memberDeliveries: memberDeliveries
        };
    },

    _parseCommaString(str) {
        if (!str) return [];
        return str.toString().split(',').map(s => s.trim().replace(/\s/g, '')).filter(s => s.length > 0);
    },

    async parseSingleFile(file, platform, activeMembers) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 시트 목록 디버깅 로그
                    console.log(`[Excel Debug] Sheets found:`, workbook.SheetNames);

                    // 쿠팡: '오더별 상세내역' 시트 우선 탐색, 없으면 첫 번째 시트 사용
                    let sheetName = workbook.SheetNames[0];
                    if (platform === 'coupang') {
                        const coupangSheet = workbook.SheetNames.find(n => n.includes('오더별') || n.includes('상세내역') || n.includes('주문') || n.includes('Order'));
                        if (coupangSheet) {
                            sheetName = coupangSheet;
                            console.log(`[Excel Debug] Target Coupang sheet selected: ${sheetName}`);
                        } else {
                            console.log(`[Excel Debug] Coupang sheet not found by keyword, using first sheet: ${sheetName}`);
                        }
                    }

                    const worksheet = workbook.Sheets[sheetName];
                    
                    // ✅ 제목 행(Header Row) 자동 찾기 로직
                    // 첫 20행을 뒤져서 '성함'이나 '라이더명', '이름'이 있는 행을 헤더로 설정
                    const range = XLSX.utils.decode_range(worksheet['!ref']);
                    let headerRowIndex = 0;
                    for (let r = 0; r <= Math.min(20, range.e.r); r++) {
                        let isHeader = false;
                        for (let c = range.s.c; c <= range.e.c; c++) {
                            const cell = worksheet[XLSX.utils.encode_cell({r, c})];
                            if (cell && cell.v) {
                                const val = cell.v.toString().replace(/\s/g, '');
                                if (['성함', '라이더명', '이름', '기사명', '라이더ID', 'UserID'].some(k => val.includes(k))) {
                                    isHeader = true;
                                    break;
                                }
                            }
                        }
                        if (isHeader) {
                            headerRowIndex = r;
                            break;
                        }
                    }

                    // 찾은 헤더 행부터 데이터를 읽음
                    const json = XLSX.utils.sheet_to_json(worksheet, { 
                        defval: "",
                        range: headerRowIndex 
                    });
                    
                    console.log(`[Excel Debug] Header row found at index: ${headerRowIndex}`);
                    console.log(`[Excel Debug] Sample row data:`, json.length > 0 ? json[0] : "No Data");
                    
                    let matchedDeliveries = 0;
                    let unmatchedRecords = [];
                    let memberDeliveries = {}; // { memberId: count }
                    
                    json.forEach(row => {
                        // 각 행은 배달 1건 = count 1 (집계형 파일이 아닌 건별 파일)
                        const deliveryCount = 1;

                        if (platform === 'baemin') {
                            // ✅ 취소/반려 건만 제외
                            const status = this._findValue(row, ['배달상태']);
                            const statusStr = status.toString().trim();
                            const excludedStatuses = ['취소', '반려', '취소완료', '배달취소', 'cancel', 'cancelled', 'rejected'];
                            if (statusStr && excludedStatuses.some(s => statusStr.toLowerCase().includes(s))) return;

                            // 라이더ID, User ID 모두 탐색
                            const id = this._findValue(row, ['라이더id', 'userid', 'user id', '아이디', '배민아이디', '라이더계정', '이메일']);
                            const name = this._findValue(row, ['라이더명', '이름', '기사명', '성명', '라이더이름']);
                            
                            const cleanExcelId = id.toString().trim();
                            const cleanExcelName = name.toString().trim().replace(/\s/g, '');

                            const member = activeMembers.find(m => {
                                if (m.status && m.status !== 'approved') return false;

                                const dbNames = this._parseCommaString(m.name);
                                const dbBaeminIds = this._parseCommaString(m.baeminId);
                                
                                // 1순위: ID 매칭
                                const isIdMatch = cleanExcelId && dbBaeminIds.some(dbId => dbId.toLowerCase() === cleanExcelId.toLowerCase());
                                if (isIdMatch) return true;

                                // 2순위: ID가 다르더라도 이름이 일치하면 매칭 (숫자ID vs 문자ID 케이스 대응)
                                const isNameMatch = cleanExcelName && dbNames.includes(cleanExcelName);
                                return isNameMatch;
                            });

                            if (member) {
                                matchedDeliveries += deliveryCount;
                                memberDeliveries[member.id] = (memberDeliveries[member.id] || 0) + deliveryCount;
                            } else {
                                console.log(`[Baemin Match Fail] Name: ${name}, ID: ${id}`);
                                if (name || id) unmatchedRecords.push({ name, identifier: id, type: 'baemin' });
                            }

                        } else if (platform === 'coupang') {
                            // ✅ 쿠팡: '성함' 칼럼 포함하여 이름 탐색
                            const rawName = this._findValue(row, ['성함', '이름', '기사명', '파트너명', '성명', '라이더명', '배달파트너명']);
                            let phone = this._findValue(row, ['전화번호', '연락처', '휴대폰', '휴대전화', '휴대폰번호', '전화']);
                            
                            let name = rawName;
                            let phoneLast4 = '';

                            // 이름+전화 합쳐진 형식 처리 (예: 홍길동1234)
                            if (!phone && rawName) {
                                const combinedMatch = rawName.toString().match(/^(.*?)([0-9]{4})$/);
                                if (combinedMatch) {
                                    name = combinedMatch[1].trim();
                                    phoneLast4 = combinedMatch[2];
                                }
                            } else if (phone) {
                                phoneLast4 = phone.toString().replace(/[^0-9]/g, '').slice(-4);
                            }

                            const cleanExcelName = name.toString().replace(/\s/g, '');

                            const member = activeMembers.find(m => {
                                // status가 'approved'이거나 아예 없는 경우 허용
                                if (m.status && m.status !== 'approved') return false;

                                const dbNames = this._parseCommaString(m.name);
                                const dbCoupangPhones = this._parseCommaString(m.coupangPhone);
                                
                                const isNameMatch = dbNames.includes(cleanExcelName);
                                const isPhoneMatch = phoneLast4 ? dbCoupangPhones.includes(phoneLast4) : false;
                                
                                if (phoneLast4) {
                                    return isNameMatch && isPhoneMatch;
                                } else {
                                    return isNameMatch;
                                }
                            });
                            
                            if (member) {
                                matchedDeliveries += deliveryCount;
                                memberDeliveries[member.id] = (memberDeliveries[member.id] || 0) + deliveryCount;
                            } else {
                                console.log(`[Coupang Match Fail] Name: ${name}, PhoneLast4: ${phoneLast4}`);
                                if (cleanExcelName) unmatchedRecords.push({ name: rawName, identifier: phoneLast4 || '번호없음', type: 'coupang' });
                            }
                        }
                    });

                    resolve({
                        totalRowsProcessed: json.length,
                        matchedDeliveries: matchedDeliveries,
                        unmatchedCount: unmatchedRecords.length,
                        unmatchedSamples: unmatchedRecords,
                        memberDeliveries: memberDeliveries
                    });

                } catch (error) {
                    console.error("Excel parse error:", error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    // 칼럼명 검색: 공백 제거 + 소문자 변환으로 유연하게 매칭
    _findValue(row, possibleKeys) {
        const lowerPossibleKeys = possibleKeys.map(k => k.toLowerCase().replace(/\s/g, ''));
        for (let key in row) {
            const cleanKey = key.trim().replace(/\s/g, '').toLowerCase();
            if (lowerPossibleKeys.includes(cleanKey)) {
                return row[key];
            }
        }
        return '';
    },

    /**
     * 파일명에서 날짜를 추출하여 수요일 기준 weekName 반환
     * 예: "2026-04-1.xlsx" → "04.30(수) ~ 05.06(화) 정산"
     */
    detectWeekFromFilename(filename) {
        // YYYY-MM-D 또는 YYYY.MM.D 패턴 추출
        const m = filename.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
        if (!m) return null;

        const fileDate = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
        if (isNaN(fileDate.getTime())) return null;

        // 해당 날짜가 속한 주의 수요일 계산
        const d = new Date(fileDate);
        d.setHours(0, 0, 0, 0);
        const diffToWed = (d.getDay() + 7 - 3) % 7; // 0=일, 3=수
        d.setDate(d.getDate() - diffToWed);

        const tue = new Date(d);
        tue.setDate(tue.getDate() + 6);

        const fmt = dt => `${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
        return `${fmt(d)}(수) ~ ${fmt(tue)}(화) 정산`;
    }
};
