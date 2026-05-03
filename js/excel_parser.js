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
                    
                    // 쿠팡: '오더별 상세내역' 시트 우선 탐색, 없으면 첫 번째 시트 사용
                    let sheetName = workbook.SheetNames[0];
                    if (platform === 'coupang') {
                        const coupangSheet = workbook.SheetNames.find(n => n.includes('오더별') || n.includes('상세내역') || n.includes('주문'));
                        if (coupangSheet) sheetName = coupangSheet;
                    }

                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    
                    let matchedDeliveries = 0;
                    let unmatchedRecords = [];
                    let memberDeliveries = {}; // { memberId: count }
                    
                    json.forEach(row => {
                        // 각 행은 배달 1건 = count 1 (집계형 파일이 아닌 건별 파일)
                        const deliveryCount = 1;

                        if (platform === 'baemin') {
                            // ✅ 배달상태가 '완료'인 건만 집계 (취소/반려 제외)
                            const status = this._findValue(row, ['배달상태']);
                            if (status && status.toString().trim() !== '완료') return;

                            // 라이더ID, User ID 모두 탐색
                            const id = this._findValue(row, ['라이더id', 'userid', '아이디', '배민아이디', '라이더계정', '이메일']);
                            const name = this._findValue(row, ['라이더명', '이름', '기사명', '성명', '라이더이름']);
                            
                            const cleanExcelId = id.toString().trim();
                            const cleanExcelName = name.toString().trim().replace(/\s/g, '');

                            const member = activeMembers.find(m => {
                                if (m.status !== 'approved') return false;

                                const dbNames = this._parseCommaString(m.name);
                                const dbBaeminIds = this._parseCommaString(m.baeminId);
                                
                                // ID 우선 매칭 (라이더ID 또는 User ID)
                                if (cleanExcelId && dbBaeminIds.some(dbId => dbId.toLowerCase() === cleanExcelId.toLowerCase())) return true;
                                // ID 없으면 이름으로 매칭
                                if (!cleanExcelId && cleanExcelName && dbNames.includes(cleanExcelName)) return true;
                                
                                return false;
                            });

                            if (member) {
                                matchedDeliveries += deliveryCount;
                                memberDeliveries[member.id] = (memberDeliveries[member.id] || 0) + deliveryCount;
                            } else {
                                // 배달상태가 완료인데 매칭 실패한 경우만 기록
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
                                if (m.status !== 'approved') return false;

                                const dbNames = this._parseCommaString(m.name);
                                const dbCoupangPhones = this._parseCommaString(m.coupangPhone);
                                
                                const isNameMatch = dbNames.includes(cleanExcelName);
                                const isPhoneMatch = phoneLast4 ? dbCoupangPhones.includes(phoneLast4) : false;
                                
                                // ✅ 전화번호가 엑셀에 있으면 이름+전화 모두 일치해야 매칭
                                // ✅ 전화번호가 엑셀에 없으면 이름만으로 매칭 (쿠팡 오더별 상세내역 형식)
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
    }
};
