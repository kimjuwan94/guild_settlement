const db = {
    _key: 'guild_sys_data_v3',
    
    _defaultData: {
        currentWeekId: null, // "YYYY-MM-DD" of the most recent Wednesday
        guilds: [
            { id: 'G_RECOVERED', name: '김해플로체', gmName: '김현제', username: '김현제', password: '4858', createdAt: '2026-05-03', tier: 'Bronze' }
        ],
        members: [
            { id: 'MR01', guildId: 'G_RECOVERED', name: '박준석', baeminId: '', coupangPhone: '9952', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR02', guildId: 'G_RECOVERED', name: '안정호', baeminId: '', coupangPhone: '2744', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR03', guildId: 'G_RECOVERED', name: '왕정호', baeminId: '', coupangPhone: '2744', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR04', guildId: 'G_RECOVERED', name: '김동훈', baeminId: '', coupangPhone: '0027', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR05', guildId: 'G_RECOVERED', name: '유정희', baeminId: '', coupangPhone: '4939', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR06', guildId: 'G_RECOVERED', name: '신성배', baeminId: '', coupangPhone: '5951', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR07', guildId: 'G_RECOVERED', name: '석우찬', baeminId: '', coupangPhone: '9042', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR08', guildId: 'G_RECOVERED', name: '김현제', baeminId: '', coupangPhone: '5951', deliveries: 0, status: 'approved', createdAt: '2026-05-03' }
        ],
        settlements: [],
        globalNotice: "",
        upgradeRequests: [] // { guildId, currentTier, requestedTier, status: 'pending'|'approved'|'rejected', createdAt }
    },

    _memoryData: null,
    _firebaseUrl: 'https://floche-gm-default-rtdb.firebaseio.com/data.json',

    async loadFromServer() {
        try {
            // 1. Firebase에서 데이터 가져오기
            const response = await fetch(this._firebaseUrl);
            const cloudData = await response.json();

            const localDataStr = localStorage.getItem(this._key);
            let localData = null;
            if (localDataStr) {
                localData = JSON.parse(localDataStr);
            }

            if (cloudData) {
                // Firebase 데이터와 기본 복구 데이터를 지능적으로 합침 (Merge)
                const mergedGuilds = [...this._defaultData.guilds];
                (cloudData.guilds || []).forEach(cg => {
                    if (!mergedGuilds.find(mg => mg.id === cg.id)) mergedGuilds.push(cg);
                });

                const mergedMembers = [...this._defaultData.members];
                (cloudData.members || []).forEach(cm => {
                    if (!mergedMembers.find(mm => mm.id === cm.id)) mergedMembers.push(cm);
                });

                this._memoryData = { 
                    ...this._defaultData, 
                    ...cloudData, 
                    guilds: mergedGuilds,
                    members: mergedMembers
                };
                
                // 최신 합본을 로컬과 서버에 다시 백업
                localStorage.setItem(this._key, JSON.stringify(this._memoryData));
                this.saveData(this._memoryData);
            } else {
                // Firebase가 텅 비어있음 (최초 생성)
                if (localData) {
                    console.log('Migrating local data to empty Firebase...');
                    this._memoryData = { ...this._defaultData, ...localData };
                } else {
                    this._memoryData = { ...this._defaultData };
                }
                this.saveData(this._memoryData);
            }
        } catch (e) {
            console.error('Firebase load failed, falling back to local storage:', e);
            const localData = localStorage.getItem(this._key);
            if (localData) {
                this._memoryData = { ...this._defaultData, ...JSON.parse(localData) };
            } else {
                this._memoryData = this._defaultData;
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

    createGuild(name, gmName, bankName = '', accountNumber = '') {
        const data = this.getData();
        const count = data.guilds.length + 1;
        const generatedId = 'G' + String(count).padStart(3, '0');
        
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
            createdAt: new Date().toISOString().split('T')[0]
        };
        data.guilds.push(newGuild);
        this.saveData(data);
        return newGuild;
    },

    updateGuild(guildId, newUsername, newPassword, bankName = '', accountNumber = '') {
        const data = this.getData();
        const guild = data.guilds.find(g => g.id === guildId);
        if (guild) {
            guild.username = newUsername;
            if(newPassword) guild.password = newPassword;
            guild.bankName = bankName;
            guild.accountNumber = accountNumber;
            this.saveData(data);
            return true;
        }
        return false;
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

        const count = data.members.length + 1;
        member.id = 'M' + String(count).padStart(3, '0');
        member.guildId = guildId;
        member.deliveries = 0; // Initialize deliveries
        member.createdAt = new Date().toISOString().split('T')[0];
        member.memo = member.memo || ''; // 추가된 메모 필드
        member.status = 'approved'; // simplified: auto approve for now
        data.members.push(member);
        this.saveData(data);
        return member;
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
        const members = this.getMembers(guildId).filter(m => m.status === 'approved');
        const guild = this.getGuildById(guildId);
        if (!guild) return members.length;
        
        // 길드장이 승인된 멤버 리스트에 이미 등록되어 있는지 확인 (공백 무시)
        const isGmInList = members.some(m => m.name.replace(/\s/g,'') === guild.gmName.replace(/\s/g,''));
        
        // 멤버 수 + (길드장이 등록 안되어 있으면 1명 추가)
        return members.length + (isGmInList ? 0 : 1);
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

    // Internal finalization logic
    _runFinalization(data, weekName, settlementEngine) {
        // Calculate settlement for each guild and save to history
        data.guilds.forEach(guild => {
            // 정산 시 'approved' 상태인 멤버의 실적만 가져오지만, 애초에 parser에서 매칭을 거부하므로 deliveries는 0일 것임.
            // 안전을 위해 getMembers(guild.id).filter 활용 (데이터 일관성 보장)
            const guildMembers = this.getMembers(guild.id);
            const approvedMembers = guildMembers.filter(m => m.status === 'approved');
            
            const totalDeliveries = approvedMembers.reduce((sum, m) => sum + (m.deliveries || 0), 0);
            
            const isGmInList = approvedMembers.some(m => m.name.replace(/\s/g,'') === guild.gmName.replace(/\s/g,''));
            const activeCount = approvedMembers.length + (isGmInList ? 0 : 1);
            
            const result = settlementEngine.calculateSettlement(activeCount, totalDeliveries);
            
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
                isPaid: false
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
            // Recalculate chunks based on new deliveries?
            // Since this is a manual override, we might just keep the chunks as is, or recalculate tier
            // For simplicity in manual override, we just update the totals.
            this.saveData(data);
            return true;
        }
        return false;
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
    }
};

// Note: db.loadFromServer() is called by app.init() in app.js on DOMContentLoaded
