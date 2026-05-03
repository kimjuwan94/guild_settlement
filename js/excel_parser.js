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
            unmatchedSamples: allUnmatchedSamples.slice(0, 5), // Keep top 5 samples
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
                    
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    
                    let matchedDeliveries = 0;
                    let unmatchedRecords = [];
                    let memberDeliveries = {}; // { memberId: count }
                    
                    json.forEach(row => {
                        let deliveryCount = 1; 
                        const countKeys = ['건수', '배달건수', '완료건수', '총건수', '배송건수', '수행건수'];
                        for (let key in row) {
                            const cleanKey = key.trim().replace(/\s/g, '');
                            if (countKeys.includes(cleanKey) && !isNaN(row[key])) {
                                deliveryCount = parseInt(row[key], 10);
                            }
                        }

                        if (platform === 'baemin') {
                            const name = this._findValue(row, ['이름', '기사명', '라이더명', '성명', '라이더이름']);
                            const id = this._findValue(row, ['아이디', '배민아이디', 'id', '라이더id', '아이디(이메일)', '이메일', '라이더계정']);
                            
                            const cleanExcelName = name.toString().trim().replace(/\s/g, '');
                            const cleanExcelId = id.toString().trim();

                            const member = activeMembers.find(m => {
                                if (m.status !== 'approved') return false; // 승인된 멤버만 매칭

                                const dbNames = this._parseCommaString(m.name);
                                const dbBaeminIds = this._parseCommaString(m.baeminId);
                                
                                // 배민은 ID가 고유하므로 ID가 엑셀에 있고 일치하면 무조건 매칭
                                if (cleanExcelId && dbBaeminIds.includes(cleanExcelId)) return true;
                                // 만약 엑셀에 ID가 누락되고 이름만 있다면 이름으로라도 매칭
                                if (!cleanExcelId && cleanExcelName && dbNames.includes(cleanExcelName)) return true;
                                
                                return false;
                            });

                            if (member) {
                                matchedDeliveries += deliveryCount;
                                memberDeliveries[member.id] = (memberDeliveries[member.id] || 0) + deliveryCount;
                            } else {
                                if (name || id) unmatchedRecords.push({ name, identifier: id, type: 'baemin' });
                            }
                        } else if (platform === 'coupang') {
                            const rawName = this._findValue(row, ['이름', '기사명', '파트너명', '성명', '라이더명', '배달파트너명']);
                            let phone = this._findValue(row, ['전화번호', '연락처', '휴대폰', '휴대전화', '휴대폰번호', '전화']);
                            
                            let name = rawName;
                            let phoneLast4 = '';

                            // 전화번호 칼럼이 따로 없고, 이름에 숫자가 붙어있는 경우 (예: 홍길동1234)
                            if (!phone && rawName) {
                                const combinedMatch = rawName.toString().match(/^(.*?)([0-9]{4})$/);
                                if (combinedMatch) {
                                    name = combinedMatch[1].trim();
                                    phoneLast4 = combinedMatch[2];
                                }
                            } else if (phone) {
                                phoneLast4 = phone.toString().replace(/[^0-9]/g, '').slice(-4);
                            }

                            // 이름 내 공백 제거 후 비교 (홍 길동 == 홍길동)
                            const cleanExcelName = name.toString().replace(/\s/g, '');

                            const member = activeMembers.find(m => {
                                if (m.status !== 'approved') return false; // 승인된 멤버만 매칭

                                const dbNames = this._parseCommaString(m.name);
                                const dbCoupangPhones = this._parseCommaString(m.coupangPhone);
                                
                                const isNameMatch = dbNames.includes(cleanExcelName);
                                const isPhoneMatch = dbCoupangPhones.includes(phoneLast4);
                                
                                // 쿠팡은 이름과 뒷자리 4자리가 모두 맞아야 함 (동명이인/동일뒷자리 방지)
                                return isNameMatch && isPhoneMatch;
                            });
                            
                            if (member) {
                                matchedDeliveries += deliveryCount;
                                memberDeliveries[member.id] = (memberDeliveries[member.id] || 0) + deliveryCount;
                            } else {
                                if (name || phoneLast4) unmatchedRecords.push({ name: rawName, identifier: phoneLast4 || '번호없음', type: 'coupang' });
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

    _findValue(row, possibleKeys) {
        // 소문자로 변환하여 비교 (ID -> id 등)
        const lowerPossibleKeys = possibleKeys.map(k => k.toLowerCase());
        for (let key in row) {
            const cleanKey = key.trim().replace(/\s/g, '').toLowerCase();
            if (lowerPossibleKeys.includes(cleanKey)) {
                return row[key];
            }
        }
        return '';
    }
};
