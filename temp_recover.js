const db = {
    _key: 'guild_sys_data_v3',
    
    _defaultData: {
        currentWeekId: null, // "YYYY-MM-DD" of the most recent Wednesday
        guilds: [
            { id: 'G001', name: '?뚯뒪??湲몃뱶', gmName: '?뚯뒪??湲몃뱶??, username: 'gm_g001', password: '1234', createdAt: '2023-10-01' }
        ],
        members: [
            { id: 'M001', guildId: 'G001', name: '?띻만??, baeminId: 'hong123', coupangPhone: '1234', deliveries: 0, createdAt: '2023-10-01' },
            { id: 'M002', guildId: 'G001', name: '源泥좎닔', baeminId: 'kim456', coupangPhone: '5678', deliveries: 0, createdAt: '2023-10-05' },
        ],
        settlements: [],
        globalNotice: ""
    },

    _memoryData: null,
    _firebaseUrl: 'https://floche-gm-default-rtdb.firebaseio.com/data.json',

    async loadFromServer() {
        try {
            // 1. Firebase?먯꽌 ?곗씠??媛?몄삤湲?            const response = await fetch(this._firebaseUrl);
            const cloudData = await response.json();

            const localDataStr = localStorage.getItem(this._key);
            let localData = null;
            if (localDataStr) {
                localData = JSON.parse(localDataStr);
            }

            if (cloudData) {
                // Firebase???곗씠?곌? ?덉쑝硫??대씪?곕뱶 ?곗씠?곕? 理쒖슦?좎쑝濡??ъ슜
                this._memoryData = { ...this._defaultData, ...cloudData };
                
                // 留뚯빟 濡쒖뺄?먮뒗 ?덈뒗???대씪?곕뱶媛 嫄곗쓽 鍮꾩뼱?덈뒗 珥덇린 ?곹깭?쇰㈃ 濡쒖뺄 ?곗씠?곕? 諛?대꽔湲?(留덉씠洹몃젅?댁뀡)
                if (localData && (!cloudData.guilds || cloudData.guilds.length === 0)) {
                    console.log('Migrating local data to Firebase...');
                    this._memoryData = { ...this._defaultData, ...localData };
                    this.saveData(this._memoryData);
                } else {
                    // ?대씪?곕뱶 ?곗씠?곕? 濡쒖뺄??諛깆뾽
                    localStorage.setItem(this._key, JSON.stringify(this._memoryData));
                }
            } else {
                // Firebase媛 ??鍮꾩뼱?덉쓬 (理쒖큹 ?앹꽦)
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
        const count = data.members.length + 1;
        member.id = 'M' + String(count).padStart(3, '0');
        member.guildId = guildId;
        member.deliveries = 0; // Initialize deliveries
        member.createdAt = new Date().toISOString().split('T')[0];
        member.memo = member.memo || ''; // 異붽???硫붾え ?꾨뱶
        member.status = 'pending'; // ?덈줈 異붽???湲몃뱶?먯? ?뱀씤 ?湲?        data.members.push(member);
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
    }
};

// Initialize on load
db.init();
