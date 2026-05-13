/**
 * =====================================================
 *  EVENT DB - 이벤트/추첨 관리 데이터 모듈
 *  Firebase Realtime DB + localStorage 이중 저장
 *  ★ 이벤트 전용 정산서 저장소 분리 (income_settlements와 독립)
 * =====================================================
 */
const eventDb = {
    // ── 이벤트 기록 저장소 ──────────────────────────────────
    _firebaseUrl:  'https://floche-gm-default-rtdb.firebaseio.com/events.json',
    _localKey:     'guild_events_v1',

    // ── 이벤트 전용 정산서 저장소 (소득신고 정산과 완전 분리) ──
    _fbSettleUrl:  'https://floche-gm-default-rtdb.firebaseio.com/event_settlements.json',
    _settleKey:    'guild_event_settlements_v1',

    // ── 이벤트 참여자(탈퇴/활동) 저장소 ──
    _fbParticipantsUrl: 'https://floche-gm-default-rtdb.firebaseio.com/event_participants.json',
    _participantsKey:   'guild_event_participants_v1',

    // ── 팀/길드 관리 저장소 ──
    _fbTeamsUrl:        'https://floche-gm-default-rtdb.firebaseio.com/event_teams.json',
    _teamsKey:          'guild_event_teams_v1',

    // ── 내부 헬퍼 ──────────────────────────────────────────
    _getLocal(key)       { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } },
    _saveLocal(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },

    async _push(url, data) {
        try {
            await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        } catch (e) { console.warn('[eventDb] Firebase push failed:', e.message); }
    },

    // ── 초기 로드 (이벤트 + 정산서 동시) ──────────────────
    async load() {
        try {
            const [r1, r2, r3, r4] = await Promise.all([
                fetch(this._firebaseUrl),
                fetch(this._fbSettleUrl),
                fetch(this._fbParticipantsUrl),
                fetch(this._fbTeamsUrl)
            ]);
            const events       = await r1.json();
            const settles      = await r2.json();
            const participants = await r3.json();
            const teams        = await r4.json();
            
            this._saveLocal(this._localKey,       Array.isArray(events)       ? events       : []);
            this._saveLocal(this._settleKey,      Array.isArray(settles)      ? settles      : []);
            this._saveLocal(this._participantsKey, Array.isArray(participants) ? participants : []);
            this._saveLocal(this._teamsKey,       Array.isArray(teams)        ? teams        : []);
        } catch (e) {
            console.warn('[eventDb] Firebase load failed, using local:', e.message);
        }
    },

    // ── 이벤트 CRUD ────────────────────────────────────────
    getEvents() { return this._getLocal(this._localKey); },

    createEvent(params) {
        const events = this.getEvents();
        const event = {
            eventId: 'EV_' + Date.now(),
            title: params.title || '추첨 이벤트',
            type: params.type || 'roulette',
            status: 'active',
            weekLabel: params.weekLabel || '',
            region: params.region || '전체',
            acceptRateMin: params.acceptRateMin || 0,
            rewardAmount: params.rewardAmount || 0,
            rewardLabel: params.rewardLabel || '이벤트 당첨금',
            excludePrevWinners: params.excludePrevWinners || false,
            prevWinnerIds: params.prevWinnerIds || [],
            winners: [],
            createdAt: new Date().toISOString()
        };
        events.unshift(event);
        this._saveLocal(this._localKey, events);
        this._push(this._firebaseUrl, events);
        return event;
    },

    addWinner(eventId, winner) {
        const events = this.getEvents();
        const event = events.find(e => e.eventId === eventId);
        if (!event) return false;
        event.winners.push({ ...winner, confirmedAt: null, addedAt: new Date().toISOString() });
        this._saveLocal(this._localKey, events);
        this._push(this._firebaseUrl, events);
        return true;
    },

    confirmRewards(eventId) {
        const events = this.getEvents();
        const event = events.find(e => e.eventId === eventId);
        if (!event) return false;
        event.status = 'rewarded';
        event.winners = event.winners.map(w => ({ ...w, confirmedAt: new Date().toISOString() }));
        this._saveLocal(this._localKey, events);
        this._push(this._firebaseUrl, events);
        return event;
    },

    deleteEvent(eventId) {
        const events = this.getEvents().filter(e => e.eventId !== eventId);
        this._saveLocal(this._localKey, events);
        this._push(this._firebaseUrl, events);
    },

    // ── 이벤트 전용 정산서 CRUD ────────────────────────────
    getEventSettlements() { return this._getLocal(this._settleKey); },

    /**
     * 이벤트 정산서 배치 추가
     * @param {string} platform  - 'baemin' | 'coupang'
     * @param {string} weekLabel - '2026-05-1'
     * @param {string} region    - '김해북부'
     * @param {Array}  records   - [{ riderId, name, amount, acceptRate? }]
     */
    addEventSettlementBatch(platform, dateOrWeek, region, records, skipPush = false) {
        let settles = this.getEventSettlements();
        // 중복 방지: 동일한 플랫폼, 날짜, 권역의 정산서가 이미 존재하면 덮어쓰기(삭제 후 추가)
        settles = settles.filter(b => !(b.platform === platform && b.date === dateOrWeek && b.region === region.trim()));

        const batch = {
            batchId:    'EB_' + Date.now() + Math.floor(Math.random()*1000), // 빠른 루프 시 중복 ID 방지
            platform,
            date:       dateOrWeek,   // YYYY-MM-DD 형식 (일정산) 또는 주차 문자열
            weekLabel:  dateOrWeek,   // 룰렛/랭킹 필터와 호환성 유지
            region:     region.trim(),
            uploadedAt: new Date().toISOString(),
            records
        };
        settles.push(batch);
        this._saveLocal(this._settleKey, settles);
        if (!skipPush) this._push(this._fbSettleUrl, settles);
        return batch;
    },

    updateBatchDate(batchId, date, skipPush = false) {
        const settles = this.getEventSettlements();
        const b = settles.find(s => s.batchId === batchId);
        if (b) { 
            b.date = date; 
            this._saveLocal(this._settleKey, settles); 
            if (!skipPush) this._push(this._fbSettleUrl, settles); 
        }
    },

    pushEventSettlements() {
        this._push(this._fbSettleUrl, this.getEventSettlements());
    },

    deleteEventSettlementBatch(batchId) {
        const settles = this.getEventSettlements().filter(b => b.batchId !== batchId);
        this._saveLocal(this._settleKey, settles);
        this._push(this._fbSettleUrl, settles);
    },

    // ── 참여자 관리 CRUD ──────────────────────────────────
    getParticipants() { return this._getLocal(this._participantsKey); },
    getWithdrawnRiderIds() {
        return this.getParticipants()
            .filter(p => p.status === 'withdrawn')
            .map(p => p.riderId);
    },
    toggleParticipantStatus(riderId, name, region) {
        let list = this.getParticipants();
        let p = list.find(x => x.riderId === riderId);
        if (!p) {
            p = { riderId, name, region, status: 'withdrawn' }; // 새로 등록 시 바로 탈퇴로
            list.push(p);
        } else {
            p.status = p.status === 'withdrawn' ? 'active' : 'withdrawn';
            p.name = name; // 이름/권역 업데이트
            p.region = region;
        }
        this._saveLocal(this._participantsKey, list);
        this._push(this._fbParticipantsUrl, list);
        return p.status;
    },

    // ── 팀(길드) 관리 CRUD ────────────────────────────────
    getTeams() { return this._getLocal(this._teamsKey); },
    
    saveTeam(teamId, teamName, leaderName, memberNamesStr, targetCalls = 1000, rewardPerTarget = 100000) {
        let teams = this.getTeams();
        const memberNames = memberNamesStr.split(',').map(s => s.trim()).filter(s => s);
        
        if (teamId) {
            const idx = teams.findIndex(t => t.teamId === teamId);
            if (idx !== -1) {
                teams[idx] = { ...teams[idx], teamName, leaderName, members: memberNames, targetCalls, rewardPerTarget };
            }
        } else {
            teams.push({
                teamId: 'TEAM_' + Date.now(),
                teamName, leaderName, members: memberNames, targetCalls, rewardPerTarget, createdAt: new Date().toISOString()
            });
        }
        this._saveLocal(this._teamsKey, teams);
        this._push(this._fbTeamsUrl, teams);
    },

    deleteTeam(teamId) {
        let teams = this.getTeams().filter(t => t.teamId !== teamId);
        this._saveLocal(this._teamsKey, teams);
        this._push(this._fbTeamsUrl, teams);
    },

    // ── 룰렛 후보 추출 (이벤트 전용 정산서 기준) ──────────
    getRouletteCandidates(startDate, endDate, region, acceptRateMin, excludeIds) {
        const settles = this.getEventSettlements().filter(b => {
            const dateStr = b.date || b.weekLabel || '';
            const batchStart = dateStr.split('~')[0].trim();
            const batchEnd = dateStr.includes('~') ? dateStr.split('~')[1].trim() : batchStart;
            
            const startOk = !startDate || batchEnd >= startDate;
            const endOk   = !endDate   || batchStart <= endDate;
            const rm = !region || region === '전체' || b.region === region;
            
            return startOk && endOk && rm;
        });

        const riderMap = {};
        settles.forEach(batch => {
            (batch.records || []).forEach(rec => {
                if (!rec.riderId && !rec.name) return;
                const key = rec.riderId || rec.name;
                if (!riderMap[key]) {
                    riderMap[key] = { 
                        riderId: key, 
                        name: rec.displayName || rec.name || key, // 마스킹/ID 적용된 표시 이름
                        deliveries: 0, 
                        amount: 0, 
                        acceptRate: null 
                    };
                }
                riderMap[key].deliveries += 1;
                riderMap[key].amount     += (rec.amount || 0); // 콜 수
                if (rec.acceptRate != null) riderMap[key].acceptRate = rec.acceptRate;
            });
        });

        let candidates = Object.values(riderMap);
        // 1콜 이상인 라이더만 (amount가 콜 수)
        candidates = candidates.filter(r => r.amount >= 1);

        if (acceptRateMin > 0)
            candidates = candidates.filter(r => r.acceptRate === null || r.acceptRate >= acceptRateMin);
        if (excludeIds && excludeIds.length > 0)
            candidates = candidates.filter(r => !excludeIds.includes(r.riderId));
            
        // 탈퇴자 강제 배제 로직
        const withdrawnIds = this.getWithdrawnRiderIds();
        if (withdrawnIds.length > 0) {
            candidates = candidates.filter(r => !withdrawnIds.includes(r.riderId));
        }
        
        // 랭킹 등 다른 곳에서도 일관되게 표시되도록 deliveries를 amount(총 콜 수)로 일치시킴
        candidates.forEach(c => { c.deliveries = c.amount; });
        return candidates;
    },

    /** 랭킹 집계 */
    getRanking(startDate, endDate, region, acceptRateMin, excludeIds, topN = 10) {
        return this.getRouletteCandidates(startDate, endDate, region, acceptRateMin, excludeIds)
            .sort((a, b) => b.deliveries - a.deliveries)
            .slice(0, topN);
    },

    getUniqueWeeks() {
        const set = new Set(this.getEventSettlements().map(b => b.weekLabel).filter(Boolean));
        return [...set].sort().reverse();
    },

    getUniqueRegions() {
        const set = new Set(this.getEventSettlements().map(b => b.region).filter(Boolean));
        return ['전체', ...set];
    }
};
