const db = {
    _key: 'guild_sys_data_v3',
    
    _defaultData: {
        currentWeekId: null, // "YYYY-MM-DD" of the most recent Wednesday
        guilds: [
            { id: 'G_RECOVERED', name: '源?댄뵆濡쒖껜', gmName: '源?꾩젣', username: '源?꾩젣', password: '4858', createdAt: '2026-05-03', tier: 'Bronze' }
        ],
        members: [
            { id: 'MR01', guildId: 'G_RECOVERED', name: '諛뺤???, baeminId: '', coupangPhone: '9952', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR02', guildId: 'G_RECOVERED', name: '?덉젙??, baeminId: '', coupangPhone: '2744', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR03', guildId: 'G_RECOVERED', name: '?뺤젙??, baeminId: '', coupangPhone: '2744', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR04', guildId: 'G_RECOVERED', name: '源?숉썕', baeminId: '', coupangPhone: '0027', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR05', guildId: 'G_RECOVERED', name: '?좎젙??, baeminId: '', coupangPhone: '4939', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR06', guildId: 'G_RECOVERED', name: '?좎꽦諛?, baeminId: '', coupangPhone: '5951', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR07', guildId: 'G_RECOVERED', name: '?앹슦李?, baeminId: '', coupangPhone: '9042', deliveries: 0, status: 'approved', createdAt: '2026-05-03' },
            { id: 'MR08', guildId: 'G_RECOVERED', name: '源?꾩젣', baeminId: '', coupangPhone: '5951', deliveries: 0, status: 'approved', createdAt: '2026-05-03' }
        ],
        settlements: [],
        globalNotice: "",
        upgradeRequests: [] // { guildId, currentTier, requestedTier, status: 'pending'|'approved'|'rejected', createdAt }
    },

    _memoryData: null,
    _firebaseUrl: 'https://floche-gm-default-rtdb.firebaseio.com/data.json',

    async loadFromServer() {
        try {
            // 1. ?쒕쾭(Firebase)? 濡쒖뺄(LocalStorage) ?곗씠??紐⑤몢 媛?몄삤湲?            const response = await fetch(this._firebaseUrl);
            const cloudData = await response.json();
            const localDataStr = localStorage.getItem(this._key);
            const localData = localDataStr ? JSON.parse(localDataStr) : null;

            // 2. 湲곕낯 ?곗씠??援ъ“ 以鍮?            let finalData = { ...this._defaultData };

            // 3. 吏?μ쟻 ?곗씠??蹂묓빀 (?쒕쾭 + 濡쒖뺄 + 湲곕낯蹂듦뎄?곗씠??
            const sourceData = cloudData || localData || this._defaultData;
            finalData = { ...finalData, ...sourceData };

            // 湲몃뱶 蹂묓빀
            const allGuilds = [...this._defaultData.guilds];
            [cloudData, localData].forEach(d => {
                if (d && d.guilds) {
                    d.guilds.forEach(g => {
                        if (!allGuilds.find(ag => ag.id === g.id)) allGuilds.push(g);
                    });
                }
            });
            finalData.guilds = allGuilds;

            // 硫ㅻ쾭 諛??ㅼ쟻 蹂묓빀 (理쒓퀬 ?ㅼ쟻 ?좏깮)
            const allMembers = [...this._defaultData.members];
            [cloudData, localData].forEach(d => {
                if (d && d.members) {
                    d.members.forEach(m => {
                        const existing = allMembers.find(am => am.id === m.id);
                        if (!existing) {
                            allMembers.push(m);
                        } else {
                            existing.deliveries = Math.max(existing.deliveries || 0, m.deliveries || 0);
                            if (m.tier) existing.tier = m.tier; // ?깃툒 ?뺣낫 蹂댁〈
                        }
                    });
                }
            });
            finalData.members = allMembers;

            // ?뺤궛 ?댁뿭 蹂묓빀 (以묐났 ?쒓굅)
            const allSettlements = [...(this._defaultData.settlements || [])];
            [cloudData, localData].forEach(d => {
                if (d && d.settlements) {
                    d.settlements.forEach(s => {
                        if (!allSettlements.find(as => as.id === s.id)) allSettlements.push(s);
                    });
                }
            });
            finalData.settlements = allSettlements;

            this._memoryData = finalData;
            
            // 4. ?⑸낯???묒そ???ㅼ떆 ???(蹂듦뎄 諛??숆린??
            localStorage.setItem(this._key, JSON.stringify(this._memoryData));
            if (this._memoryData.guilds.length > 0) {
                this.saveData(this._memoryData);
            }
        } catch (e) {
            console.error('Data load failed, falling back to local storage:', e);
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
        this._memoryData = data;
        
        // 1. 濡쒖뺄 諛깆뾽 ???(?ㅽ봽?쇱씤/?먮윭 ?鍮?
        try {
            localStorage.setItem(this._key, JSON.stringify(data));
        } catch (e) {
            console.error('Local storage save failed:', e);
        }

        // 2. Firebase ?ㅼ떆媛??숆린??        fetch(this._firebaseUrl, {
            method: 'PUT', // ??뼱?곌린
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(e => {
            console.error('Firebase save failed:', e);
            alert('?대씪?곕뱶 ?숆린???ㅽ뙣! ?명꽣???곌껐???뺤씤?댁＜?몄슂.');
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
            // 湲곗〈 ?곗씠???명솚: status媛 ?놁쑝硫?湲곕낯?곸쑝濡?'approved'
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
        
        // 1. ?깃툒蹂??몄썝 ?쒗븳 泥댄겕 (None: 9紐? Bronze: 10紐? Silver: 15紐? Gold: 20紐?
        const currentCount = this.getHeadcountForGuild(guildId);
        const tier = guild.tier || 'None';
        let maxLimit = 9; // None
        if (tier === 'Bronze') maxLimit = 10;
        if (tier === 'Silver') maxLimit = 15;
        if (tier === 'Gold') maxLimit = 20;

        if (currentCount >= maxLimit) {
            throw new Error(`?꾩옱 湲몃뱶 ?깃툒(${tier})??理쒕? ?몄썝(${maxLimit}紐????꾨떖?덉뒿?덈떎. ??異붽??섎젮硫?蹂몄궗???밴툒???붿껌?섏꽭??`);
        }

        const count = data.members.length + 1;
        member.id = 'M' + String(count).padStart(3, '0');
        member.guildId = guildId;
        member.deliveries = 0; // Initialize deliveries
        member.createdAt = new Date().toISOString().split('T')[0];
        member.memo = member.memo || ''; // 異붽???硫붾え ?꾨뱶
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
        // ?몄썝?섎뒗 'approved' ?곹깭??硫ㅻ쾭留?吏묎퀎
        const members = this.getMembers(guildId).filter(m => m.status === 'approved');
        const guild = this.getGuildById(guildId);
        if (!guild) return members.length;
        
        // 湲몃뱶?μ씠 ?뱀씤??硫ㅻ쾭 由ъ뒪?몄뿉 ?대? ?깅줉?섏뼱 ?덈뒗吏 ?뺤씤 (怨듬갚 臾댁떆)
        const isGmInList = members.some(m => m.name.replace(/\s/g,'') === guild.gmName.replace(/\s/g,''));
        
        // 硫ㅻ쾭 ??+ (湲몃뱶?μ씠 ?깅줉 ?덈릺???덉쑝硫?1紐?異붽?)
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
        
        return `${startStr}(?? ~ ${endStr}(?? ?뺤궛`;
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
            // ?뺤궛 ??'approved' ?곹깭??硫ㅻ쾭???ㅼ쟻留?媛?몄삤吏留? ?좎큹??parser?먯꽌 留ㅼ묶??嫄곕??섎?濡?deliveries??0??寃껋엫.
            // ?덉쟾???꾪빐 getMembers(guild.id).filter ?쒖슜 (?곗씠???쇨???蹂댁옣)
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
        if (existing) throw new Error('?대? ?뱀씤 ?湲?以묒씤 ?밴툒 ?붿껌???덉뒿?덈떎.');

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
