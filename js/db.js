const db = {
    _key: 'guild_sys_data_v3',
    
    _defaultData: {
        currentWeekId: null, // "YYYY-MM-DD" of the most recent Wednesday
        guilds: [
            { id: 'G_RECOVERED', name: '김해플로체', gmName: '김현제', username: '김현제', password: '4858', createdAt: '2026-05-03', tier: 'Bronze' }
        ],
        members: [
            { id: 'MR01', guildId: 'G_RECOVERED', name: '안재철', baeminId: 'qpfwpqnq', coupangPhone: '4774', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR02', guildId: 'G_RECOVERED', name: '최정윤', baeminId: 'jungyoon1853', coupangPhone: '6982', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR03', guildId: 'G_RECOVERED', name: '오영택', baeminId: 'liv2107', coupangPhone: '9962', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR04', guildId: 'G_RECOVERED', name: '박은규', baeminId: 'qlghdidi', coupangPhone: '3935', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR05', guildId: 'G_RECOVERED', name: '강민효', baeminId: 'rkdalsgy12', coupangPhone: '1056', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR06', guildId: 'G_RECOVERED', name: '방재진', baeminId: 'bmwbyc5414', coupangPhone: '4548', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR07', guildId: 'G_RECOVERED', name: '김효식', baeminId: 'gytlr', coupangPhone: '6797', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR08', guildId: 'G_RECOVERED', name: '송광정', baeminId: '', coupangPhone: '5222', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR09', guildId: 'G_RECOVERED', name: '김문수', baeminId: 'babb1397', coupangPhone: '1551', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR10', guildId: 'G_RECOVERED', name: '양형진', baeminId: 'gudwls1823', coupangPhone: '1823', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR11', guildId: 'G_RECOVERED', name: '김태영', baeminId: 'ftyc8008', coupangPhone: '0850', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR12', guildId: 'G_RECOVERED', name: '김현제', baeminId: '', coupangPhone: '5951', deliveries: 0, status: 'approved', createdAt: '2026-05-03' }
        ],
        settlements: [],
        globalNotice: "",
        upgradeRequests: [], // { guildId, currentTier, requestedTier, status: 'pending'|'approved'|'rejected', createdAt }
        uploadHistory: [], // [{ id, platform, weekType, weekName, uploadedAt, filenames, totalRows, matchedCount, memberDeliveries }]
        registrationHistory: [
            { type: 'system_recovery', guildId: 'G_RECOVERED', name: '시스템 복구', timestamp: new Date().toISOString(), details: '김해플로체 12명 명단 및 상세 정보(배민/쿠팡) 일괄 복구 완료' }
        ] // [{ type: 'member_add'|'guild_add', guildId, name, timestamp, details }]
    },

    _memoryData: null,
    _firebaseUrl: 'https://floche-gm-default-rtdb.firebaseio.com/data.json',

    async loadFromServer() {
        try {
            // Firebase가 항상 정답 (단일 진실의 원천)
            // localStorage는 Firebase 접속 실패 시 오프라인 백업으로만 사용
            const response = await fetch(this._firebaseUrl);
            const cloudData = await response.json();

            if (cloudData && cloudData.guilds && cloudData.guilds.length > 0) {
                // Firebase 데이터가 정상이면 그대로 사용 — 절대 로컬로 덮어쓰지 않음
                this._memoryData = { ...this._defaultData, ...cloudData };
                // 로컬 캐시 갱신 (오프라인 대비)
                localStorage.setItem(this._key, JSON.stringify(this._memoryData));
            } else {
                // Firebase가 비어 있으면 로컬 백업에서 복구 후 Firebase에 올리기
                const localDataStr = localStorage.getItem(this._key);
                const localData = localDataStr ? JSON.parse(localDataStr) : null;
                if (localData && localData.guilds && localData.guilds.length > 0) {
                    this._memoryData = { ...this._defaultData, ...localData };
                    // 로컬 데이터를 Firebase에 복구
                    fetch(this._firebaseUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(this._memoryData)
                    }).catch(e => console.error('Firebase recovery upload failed:', e));
                } else {
                    this._memoryData = { ...this._defaultData };
                }
            }
        } catch (e) {
            // Firebase 접속 실패 → 로컬 캐시로 오프라인 동작
            console.error('Firebase unreachable, using local cache:', e);
            const localDataStr = localStorage.getItem(this._key);
            if (localDataStr) {
                this._memoryData = { ...this._defaultData, ...JSON.parse(localDataStr) };
            } else {
                this._memoryData = { ...this._defaultData };
            }
        }
    },

    getData() {
        if (!this._memoryData) {
            return this._defaultData;
        }
        return this._memoryData;
    },

    saveData(data) {
        data.dataVersion = Date.now(); // 저장 시각 기록 (loadFromServer 병합 시 우선순위 결정에 사용)
        this._memoryData = data;

        // 1. 로컬 백업 저장 (오프라인/에러 대비)
        try {
            localStorage.setItem(this._key, JSON.stringify(data));
        } catch (e) {
            console.error('Local storage save failed:', e);
        }

        // 2. Firebase 실시간 동기화
        fetch(this._firebaseUrl, {
            method: 'PUT', // 덮어쓰기
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(e => {
            console.error('Firebase save failed:', e);
            alert('클라우드 동기화 실패! 인터넷 연결을 확인해주세요.');
        });
    },

    // --- Authentication ---
    authenticate(username, password) {
        if (username === 'admin' && password === 'admin123') {
            return { role: 'admin', id: 'admin' };
        }
        
        const guild = this.getGuilds().find(g => g.username === username && g.password === password);
        if (guild) {
            return { role: 'gm', id: guild.id, guild: guild };
        }
        
        return null;
    },

    // --- Guild Methods ---
    getGuilds() {
        return this.getData().guilds;
    },

    getGuildById(guildId) {
        return this.getGuilds().find(g => g.id === guildId);
    },

    createGuild(name, gmName, bankName = '', accountNumber = '', customTiers = null, customRule = null, customIncentives = null) {
        const data = this.getData();
        // 타임스탬프 기반 ID: 삭제 후 재생성 시 발생하는 ID 충돌 방지
        const generatedId = 'G' + Date.now();
        
        // Generate random 4-digit password
        const randomPw = Math.floor(1000 + Math.random() * 9000).toString();

        const newGuild = {
            id: generatedId,
            name,
            gmName,
            username: 'gm_' + generatedId.toLowerCase(),
            password: randomPw,
            bankName,
            accountNumber,
            customTiers,
            customRule,
            customIncentives,
            createdAt: new Date().toISOString().split('T')[0]
        };
        data.guilds.push(newGuild);

        // Record history
        if (!data.registrationHistory) data.registrationHistory = [];
        data.registrationHistory.push({
            type: 'guild_add',
            guildId: generatedId,
            name: name,
            timestamp: new Date().toISOString(),
            details: `Admin created guild: ${name}`
        });

        this.saveData(data);
        return newGuild;
    },

    updateGuild(guildId, newUsername, newPassword, bankName = '', accountNumber = '', customTiers = null, newName = null, newGmName = null, customRule = null, customIncentives = null) {
        const data = this.getData();
        const guild = data.guilds.find(g => g.id === guildId);
        if (guild) {
            guild.username = newUsername;
            if(newPassword) guild.password = newPassword;
            if(newName) guild.name = newName;
            if(newGmName) guild.gmName = newGmName;
            guild.bankName = bankName;
            guild.accountNumber = accountNumber;
            if(customTiers !== undefined) guild.customTiers = customTiers;
            if(customRule !== undefined) guild.customRule = customRule;
            if(customIncentives !== undefined) guild.customIncentives = customIncentives;
            
            this.saveData(data);
            return true;
        }
        return false;
    },

    deleteGuild(guildId) {
        const data = this.getData();
        // 1. 길드 삭제
        data.guilds = data.guilds.filter(g => g.id !== guildId);
        // 2. 해당 길드 소속 멤버 삭제 (연쇄 삭제)
        data.members = data.members.filter(m => m.guildId !== guildId);
        // 3. (선택사항) 해당 길드의 정산 내역도 삭제할 수 있음
        // data.settlements = data.settlements.filter(s => s.guildId !== guildId);
        
        this.saveData(data);
        return true;
    },

    // --- Notices ---
    getNotice() {
        return this.getData().globalNotice || "";
    },

    updateNotice(text) {
        const data = this.getData();
        data.globalNotice = text;
        this.saveData(data);
    },

    // --- Member Methods ---
    getMembers(guildId = null) {
        const members = this.getData().members.map(m => {
            // 기존 데이터 호환: status가 없으면 기본적으로 'approved'
            m.status = m.status || 'approved';
            return m;
        });

        if (guildId) {
            return members.filter(m => m.guildId === guildId);
        }
        return members;
    },

    addMember(guildId, member) {
        const data = this.getData();
        const guild = this.getGuildById(guildId);

        // 단일단가제 또는 팀장 인센티브 설정 길드는 인원 제한 없음
        const hasCustomRule = guild.customRule && guild.customRule.targetCalls > 0;
        const hasCustomInc = guild.customIncentives && guild.customIncentives.length > 0;

        if (!hasCustomRule && !hasCustomInc) {
            // 1. 등급별 인원 제한 체크 (None: 9명, Bronze: 10명, Silver: 15명, Gold: 20명)
            const currentCount = this.getHeadcountForGuild(guildId);
            const tier = guild.tier || 'None';
            let maxLimit = 9; // None
            if (tier === 'Bronze') maxLimit = 10;
            if (tier === 'Silver') maxLimit = 15;
            if (tier === 'Gold') maxLimit = 20;

            if (currentCount >= maxLimit) {
                throw new Error(`현재 길드 등급(${tier})의 최대 인원(${maxLimit}명)에 도달했습니다. 더 추가하려면 본사에 승급을 요청하세요.`);
            }
        }

        const count = data.members.length + 1;
        member.id = 'M' + String(count).padStart(3, '0');
        member.guildId = guildId;
        member.deliveries = 0; // Initialize deliveries
        member.createdAt = new Date().toISOString().split('T')[0];
        member.memo = member.memo || ''; // 추가된 메모 필드
        member.status = 'approved'; // simplified: auto approve for now
        data.members.push(member);

        // Record history (상세 정보 포함하여 영구 기록)
        if (!data.registrationHistory) data.registrationHistory = [];
        data.registrationHistory.push({
            type: 'member_add',
            guildId: guildId,
            name: member.name,
            timestamp: new Date().toISOString(),
            details: `신규 등록 [배민:${member.baeminId || '-'}] [쿠팡:${member.coupangPhone || '-'}] [메모:${member.memo || '-'}]`
        });

        this.saveData(data);
        return member;
    },

    updateMember(id, updatedFields) {
        const data = this.getData();
        const member = data.members.find(m => m.id === id);
        if (member) {
            Object.assign(member, updatedFields);
            
            // Record history (수정된 상세 정보 영구 기록)
            if (!data.registrationHistory) data.registrationHistory = [];
            data.registrationHistory.push({
                type: 'member_update',
                guildId: member.guildId,
                name: member.name,
                timestamp: new Date().toISOString(),
                details: `정보 수정 [배민:${member.baeminId || '-'}] [쿠팡:${member.coupangPhone || '-'}] [메모:${member.memo || '-'}]`
            });

            this.saveData(data);
            return true;
        }
        return false;
    },

    deleteMember(id) {
        const data = this.getData();
        data.members = data.members.filter(m => m.id !== id);
        this.saveData(data);
    },

    updateMemberStatus(id, newStatus) {
        const data = this.getData();
        const member = data.members.find(m => m.id === id);
        if (member) {
            member.status = newStatus;
            this.saveData(data);
            return true;
        }
        return false;
    },

    getAllPendingMembers() {
        return this.getMembers().filter(m => m.status === 'pending');
    },

    // --- Stats Methods ---
    addDeliveriesToMember(memberId, count) {
        const data = this.getData();
        const member = data.members.find(m => m.id === memberId);
        if (member) {
            member.deliveries = (member.deliveries || 0) + count;
            this.saveData(data);
        }
    },

    getTotalDeliveriesForGuild(guildId) {
        return this.getMembers(guildId).reduce((sum, m) => sum + (m.deliveries || 0), 0);
    },

    getHeadcountForGuild(guildId) {
        // 인원수는 'approved' 상태인 멤버만 집계
        return this.getMembers(guildId).filter(m => m.status === 'approved').length;
    },

    // --- Auto Finalize Date Logic ---
    getMostRecentWednesday(dateObj) {
        const d = new Date(dateObj);
        d.setHours(0, 0, 0, 0); // reset time
        const day = d.getDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
        // We want to find the nearest past Wednesday (or today if it's Wed)
        const diff = (day + 7 - 3) % 7; 
        d.setDate(d.getDate() - diff);
        return d;
    },

    formatDate(dateObj) {
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${m}.${d}`;
    },

    generateWeekName(wednesdayDateObj) {
        // start is Wednesday
        const startStr = this.formatDate(wednesdayDateObj);
        
        // end is Tuesday (+6 days)
        const tuesdayDateObj = new Date(wednesdayDateObj);
        tuesdayDateObj.setDate(tuesdayDateObj.getDate() + 6);
        const endStr = this.formatDate(tuesdayDateObj);
        
        return `${startStr}(수) ~ ${endStr}(화) 정산`;
    },

    checkAndAutoFinalize(settlementEngine) {
        const data = this.getData();
        const now = new Date();
        const wednesday = this.getMostRecentWednesday(now);
        
        // Use YYYY-MM-DD as unique ID for the week
        const currentCalculatedWeekId = wednesday.getFullYear() + '-' + 
                                        String(wednesday.getMonth() + 1).padStart(2, '0') + '-' + 
                                        String(wednesday.getDate()).padStart(2, '0');
        
        if (!data.currentWeekId) {
            // First time ever running the app, just set it
            data.currentWeekId = currentCalculatedWeekId;
            this.saveData(data);
            return;
        }

        if (data.currentWeekId !== currentCalculatedWeekId) {
            // A new Wednesday has passed since we last saved!
            // We need to finalize the old week.
            // But we need the weekName of the OLD week.
            const oldWednesday = new Date(data.currentWeekId);
            const oldWeekName = this.generateWeekName(oldWednesday);

            // Execute finalize
            this._runFinalization(data, oldWeekName, settlementEngine);

            // Update to new week
            data.currentWeekId = currentCalculatedWeekId;
            this.saveData(data);
            
            console.log(`[Auto-Finalize] Finalized old week: ${oldWeekName}. New week started: ${currentCalculatedWeekId}`);
            return oldWeekName; // Return the name of the finalized week to notify user if needed
        }
        
        return null;
    },

    getCurrentWeekName() {
        const data = this.getData();
        if(!data.currentWeekId) return "";
        const wed = new Date(data.currentWeekId);
        return this.generateWeekName(wed);
    },

    forceResetWeekly(settlementEngine) {
        const data = this.getData();
        const currentWeekName = this.getCurrentWeekName();
        if (!currentWeekName) return false;

        // 현재 쌓인 데이터를 현재 주차 이름으로 과거 정산 내역에 저장하고 모두 0으로 초기화
        this._runFinalization(data, currentWeekName + " (수동마감)", settlementEngine);
        
        this.saveData(data);
        return currentWeekName;
    },

    forceResetGuildWeekly(guildId, settlementEngine) {
        const data = this.getData();
        const currentWeekName = this.getCurrentWeekName();
        if (!currentWeekName) return false;

        const guild = data.guilds.find(g => g.id === guildId);
        if (!guild) return false;

        // 1. 해당 길드의 실적 계산
        const guildMembers = this.getMembers(guild.id);
        const approvedMembers = guildMembers.filter(m => m.status === 'approved');
        const totalDeliveries = approvedMembers.reduce((sum, m) => sum + (m.deliveries || 0), 0);
        
        const isGmInList = approvedMembers.some(m => m.name.replace(/\s/g,'') === guild.gmName.replace(/\s/g,''));
        const activeCount = approvedMembers.length + (isGmInList ? 0 : 1);
        
        const result = settlementEngine.calculateSettlement(activeCount, totalDeliveries, guild.customTiers, guild.customRule);
        
        const record = {
            id: 'S' + Date.now() + Math.floor(Math.random()*1000),
            weekName: currentWeekName + " (개별수동마감)",
            guildId: guild.id,
            date: new Date().toISOString().split('T')[0],
            memberCount: activeCount,
            totalDeliveries: totalDeliveries,
            tier: result.tier,
            recognizedDeliveries: result.recognizedDeliveries,
            chunks: result.chunks,
            totalAmount: result.totalAmount,
            isPaid: false,
            memberStats: approvedMembers.map(m => ({ id: m.id, name: m.name, deliveries: m.deliveries || 0 }))
        };
        
        data.settlements.push(record);

        // 2. 해당 길드원들만 deliveries = 0 으로 리셋
        data.members.forEach(member => {
            if (member.guildId === guild.id) {
                member.deliveries = 0;
            }
        });

        this.saveData(data);
        return currentWeekName;
    },

    // Internal finalization logic
    _runFinalization(data, weekName, settlementEngine) {
        // Calculate settlement for each guild and save to history
        data.guilds.forEach(guild => {
            // 정산 시 'approved' 상태인 멤버의 실적만 가져오지만, 애초에 parser에서 매칭을 거부하므로 deliveries는 0일 것임.
            // 안전을 위해 getMembers(guild.id).filter 활용 (데이터 일관성 보장)
            const guildMembers = this.getMembers(guild.id);
            const approvedMembers = guildMembers.filter(m => m.status === 'approved');
            
            const totalDeliveries = approvedMembers.reduce((sum, m) => sum + (m.deliveries || 0), 0);
            const activeCount = approvedMembers.length;
            
            const result = settlementEngine.calculateSettlement(activeCount, totalDeliveries, guild.customTiers, guild.customRule);
            
            const record = {
                id: 'S' + Date.now() + Math.floor(Math.random()*1000),
                weekName: weekName,
                guildId: guild.id,
                date: new Date().toISOString().split('T')[0],
                memberCount: activeCount,
                totalDeliveries: totalDeliveries,
                tier: result.tier,
                recognizedDeliveries: result.recognizedDeliveries,
                chunks: result.chunks,
                totalAmount: result.totalAmount,
                isPaid: false,
                memberStats: approvedMembers.map(m => ({ id: m.id, name: m.name, deliveries: m.deliveries || 0 }))
            };
            
            data.settlements.push(record);
        });

        // Reset all member deliveries to 0
        data.members.forEach(member => {
            member.deliveries = 0;
        });
    },

    getSettlementsByGuild(guildId) {
        return this.getData().settlements.filter(s => s.guildId === guildId).reverse(); // Newest first
    },

    getAllSettlements() {
        return this.getData().settlements;
    },

    toggleSettlementStatus(settlementId) {
        const data = this.getData();
        const s = data.settlements.find(x => x.id === settlementId);
        if (s) {
            s.isPaid = !s.isPaid;
            this.saveData(data);
            return s.isPaid;
        }
        return false;
    },

    updateSettlementManual(settlementId, newDeliveries, newAmount) {
        const data = this.getData();
        const s = data.settlements.find(x => x.id === settlementId);
        if (s) {
            s.totalDeliveries = newDeliveries;
            s.totalAmount = newAmount;
            this.saveData(data);
            return true;
        }
        return false;
    },

    getEffectiveTier(guildId) {
        const headcount = this.getHeadcountForGuild(guildId);
        const deliveries = this.getTotalDeliveriesForGuild(guildId);
        const guild = this.getGuildById(guildId);
        // Ensure settlementEngine is in global scope since db.js doesn't import it directly.
        // If not available, return '-'. (app.js includes settlement_engine.js before db.js usually)
        if (typeof SettlementEngine !== 'undefined') {
            const res = SettlementEngine.calculateSettlement(headcount, deliveries, guild?.customTiers, guild?.customRule);
            return res.tier;
        }
        return 'None';
    },

    // --- Monthly Incentive Methods ---
    getMonthlyIncentiveData(guildId) {
        const data = this.getData();
        const guild = data.guilds.find(g => g.id === guildId);
        if (!guild || !guild.customIncentives || guild.customIncentives.length === 0) return null;

        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

        let monthlyTotal = 0;
        const gmNames = guild.gmName.split(',').map(n => n.replace(/\s/g,'')).filter(n => n);

        // 1. 과거 정산된 이번 달 내역 합산 (팀장 실적 제외)
        const settlements = data.settlements.filter(s => s.guildId === guildId && s.date.startsWith(currentMonth));
        settlements.forEach(s => {
            if (s.memberStats && s.memberStats.length > 0) {
                s.memberStats.forEach(m => {
                    if (!gmNames.includes(m.name.replace(/\s/g, ''))) {
                        monthlyTotal += (m.deliveries || 0);
                    }
                });
            } else {
                // memberStats가 없는 경우의 폴백
                monthlyTotal += s.totalDeliveries;
            }
        });

        // 2. 현재 주차(진행중) 실적 및 등록 인원 합산 (팀장 제외)
        const currentMembers = this.getMembers(guildId).filter(m => m.status === 'approved');
        const teamMembersOnly = currentMembers.filter(m => !gmNames.includes(m.name.replace(/\s/g, '')));
        
        teamMembersOnly.forEach(m => {
            monthlyTotal += (m.deliveries || 0);
        });

        const activeCount = teamMembersOnly.length > 0 ? teamMembersOnly.length : 1; // 0 나누기 방지
        const monthlyAverage = Math.floor(monthlyTotal / activeCount);

        let matchedInc = null;
        for (const inc of guild.customIncentives) {
            if (monthlyAverage >= inc.min && monthlyAverage < inc.max) {
                matchedInc = inc;
                break;
            }
        }

        const expectedTotal = matchedInc ? matchedInc.amount * teamMembersOnly.length : 0;

        return {
            month: currentMonth,
            monthlyTotal,
            activeCount,
            monthlyAverage,
            expectedAmountPerPerson: matchedInc ? matchedInc.amount : 0,
            expectedTotal
        };
    },

    // 마감된 정산서에 엑셀 데이터를 소급 합산하는 핵심 함수
    addDataToSettlement(settlementId, memberDeliveriesMap, settlementEngine) {
        const data = this.getData();
        const s = data.settlements.find(x => x.id === settlementId);
        if (!s) return false;

        const guild = this.getGuildById(s.guildId);

        if (!s.memberStats) s.memberStats = [];

        // 1. 개별 멤버 실적 합산
        for (const [mId, count] of Object.entries(memberDeliveriesMap)) {
            let stat = s.memberStats.find(ms => ms.id === mId);
            if (stat) {
                stat.deliveries += count;
            } else {
                // 해당 주차에 없던 멤버가 나중에 추가되어 업로드된 경우
                const member = data.members.find(m => m.id === mId);
                s.memberStats.push({ id: mId, name: member ? member.name : 'Unknown', deliveries: count });
            }
        }

        // 2. 길드 전체 실적 재계산
        s.totalDeliveries = s.memberStats.reduce((sum, ms) => sum + ms.deliveries, 0);
        
        // 3. 정산 엔진으로 금액 재산출
        const result = settlementEngine.calculateSettlement(s.memberCount, s.totalDeliveries, guild?.customTiers, guild?.customRule);
        s.tier = result.tier;
        s.recognizedDeliveries = result.recognizedDeliveries;
        s.chunks = result.chunks;
        s.totalAmount = result.totalAmount;

        this.saveData(data);
        return true;
    },

    // --- Tier Upgrade System ---
    getUpgradeRequests() {
        return this.getData().upgradeRequests || [];
    },

    requestTierUpgrade(guildId, currentTier, requestedTier) {
        const data = this.getData();
        if (!data.upgradeRequests) data.upgradeRequests = [];
        
        // Check for existing pending request
        const existing = data.upgradeRequests.find(r => r.guildId === guildId && r.status === 'pending');
        if (existing) throw new Error('이미 승인 대기 중인 승급 요청이 있습니다.');

        data.upgradeRequests.push({
            id: 'REQ' + Date.now(),
            guildId,
            currentTier,
            requestedTier,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        this.saveData(data);
    },

    approveUpgrade(requestId) {
        const data = this.getData();
        const req = data.upgradeRequests.find(r => r.id === requestId);
        if (!req) return;

        const guild = data.guilds.find(g => g.id === req.guildId);
        if (guild) {
            guild.tier = req.requestedTier;
            req.status = 'approved';
            this.saveData(data);
        }
    },

    rejectUpgrade(requestId) {
        const data = this.getData();
        const req = data.upgradeRequests.find(r => r.id === requestId);
        if (req) {
            req.status = 'rejected';
            this.saveData(data);
        }
    },

    // --- Upload History ---
    getUploadHistory() {
        return this.getData().uploadHistory || [];
    },

    resetSettlementDeliveries(settlementId, settlementEngine) {
        const data = this.getData();
        const s = data.settlements.find(x => x.id === settlementId);
        if (!s) return false;
        const guild = data.guilds.find(g => g.id === s.guildId);
        if (s.memberStats) s.memberStats.forEach(ms => { ms.deliveries = 0; });
        s.totalDeliveries = 0;
        s.recognizedDeliveries = 0;
        s.chunks = 0;
        s.totalAmount = 0;
        if (settlementEngine) {
            const res = settlementEngine.calculateSettlement(s.memberCount, 0, guild?.customTiers, guild?.customRule);
            s.tier = res.tier;
        }
        // 이 정산의 weekName에 해당하는 과거 업로드 이력도 함께 제거
        if (data.uploadHistory) {
            data.uploadHistory = data.uploadHistory.filter(u =>
                !(u.weekName === s.weekName && u.weekType === 'past' && u.memberDeliveries &&
                  Object.keys(u.memberDeliveries).some(mId => {
                      const m = data.members.find(x => x.id === mId);
                      return m && m.guildId === s.guildId;
                  }))
            );
        }
        this.saveData(data);
        return true;
    },

    resetWeekDeliveries(weekName, settlementEngine) {
        const data = this.getData();
        const weekSettlements = data.settlements.filter(s => s.weekName === weekName);
        if (weekSettlements.length === 0) return false;
        weekSettlements.forEach(s => {
            const guild = data.guilds.find(g => g.id === s.guildId);
            if (s.memberStats) s.memberStats.forEach(ms => { ms.deliveries = 0; });
            s.totalDeliveries = 0;
            s.recognizedDeliveries = 0;
            s.chunks = 0;
            s.totalAmount = 0;
            if (settlementEngine) {
                const res = settlementEngine.calculateSettlement(s.memberCount, 0, guild?.customTiers, guild?.customRule);
                s.tier = res.tier;
            }
        });
        if (data.uploadHistory) {
            data.uploadHistory = data.uploadHistory.filter(u => u.weekName !== weekName);
        }
        this.saveData(data);
        return true;
    },

    deleteUpload(uploadId, settlementEngine) {
        const data = this.getData();
        if (!data.uploadHistory) return false;

        const record = data.uploadHistory.find(r => r.id === uploadId);
        if (!record) return false;

        if (record.weekType === 'current') {
            // 현재 주차 멤버 배달 건수에서 차감
            for (const [mId, count] of Object.entries(record.memberDeliveries)) {
                const member = data.members.find(m => m.id === mId);
                if (member) member.deliveries = Math.max(0, (member.deliveries || 0) - count);
            }
        } else {
            // 과거 정산 memberStats에서 차감 후 재계산
            const affectedGuildIds = new Set();
            for (const [mId, count] of Object.entries(record.memberDeliveries)) {
                const member = data.members.find(m => m.id === mId);
                if (!member) continue;
                const settlement = data.settlements.find(s => s.guildId === member.guildId && s.weekName === record.weekName);
                if (!settlement || !settlement.memberStats) continue;
                const stat = settlement.memberStats.find(ms => ms.id === mId);
                if (stat) stat.deliveries = Math.max(0, stat.deliveries - count);
                affectedGuildIds.add(member.guildId);
            }
            affectedGuildIds.forEach(guildId => {
                const guild = data.guilds.find(g => g.id === guildId);
                const settlement = data.settlements.find(s => s.guildId === guildId && s.weekName === record.weekName);
                if (!settlement) return;
                settlement.totalDeliveries = (settlement.memberStats || []).reduce((sum, ms) => sum + ms.deliveries, 0);
                if (settlementEngine) {
                    const res = settlementEngine.calculateSettlement(settlement.memberCount, settlement.totalDeliveries, guild?.customTiers, guild?.customRule);
                    settlement.tier = res.tier;
                    settlement.recognizedDeliveries = res.recognizedDeliveries;
                    settlement.chunks = res.chunks;
                    settlement.totalAmount = res.totalAmount;
                }
            });
        }

        data.uploadHistory = data.uploadHistory.filter(r => r.id !== uploadId);
        this.saveData(data);
        return true;
    }
};

// Note: db.loadFromServer() is called by app.init() in app.js on DOMContentLoaded
