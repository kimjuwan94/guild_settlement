/**
 * =====================================================
 *  EVENT DB - 이벤트/추첨 관리 데이터 모듈
 *  Firebase Realtime DB + localStorage 이중 저장
 * =====================================================
 */
const eventDb = {
    _firebaseUrl: 'https://floche-gm-default-rtdb.firebaseio.com/events.json',
    _localKey: 'guild_events_v1',

    _getLocal() {
        try { return JSON.parse(localStorage.getItem(this._localKey) || '[]'); } catch { return []; }
    },
    _saveLocal(data) {
        try { localStorage.setItem(this._localKey, JSON.stringify(data)); } catch {}
    },
    async _push(data) {
        try {
            await fetch(this._firebaseUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) { console.warn('[eventDb] Firebase push failed:', e.message); }
    },

    async load() {
        try {
            const res = await fetch(this._firebaseUrl);
            const cloud = await res.json();
            const data = Array.isArray(cloud) ? cloud : [];
            this._saveLocal(data);
            return data;
        } catch (e) {
            console.warn('[eventDb] Firebase load failed, using local');
            return this._getLocal();
        }
    },

    getEvents() { return this._getLocal(); },

    createEvent(params) {
        const events = this.getEvents();
        const event = {
            eventId: 'EV_' + Date.now(),
            title: params.title || '추첨 이벤트',
            type: params.type || 'roulette',   // 'roulette' | 'ranking'
            status: 'active',                   // 'active' | 'closed' | 'rewarded'
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
        this._saveLocal(events);
        this._push(events);
        return event;
    },

    updateEvent(eventId, updates) {
        const events = this.getEvents();
        const idx = events.findIndex(e => e.eventId === eventId);
        if (idx === -1) return false;
        events[idx] = { ...events[idx], ...updates };
        this._saveLocal(events);
        this._push(events);
        return true;
    },

    addWinner(eventId, winner) {
        const events = this.getEvents();
        const event = events.find(e => e.eventId === eventId);
        if (!event) return false;
        event.winners.push({ ...winner, confirmedAt: null, addedAt: new Date().toISOString() });
        this._saveLocal(events);
        this._push(events);
        return true;
    },

    confirmRewards(eventId) {
        const events = this.getEvents();
        const event = events.find(e => e.eventId === eventId);
        if (!event) return false;
        event.status = 'rewarded';
        event.winners = event.winners.map(w => ({ ...w, confirmedAt: new Date().toISOString() }));
        this._saveLocal(events);
        this._push(events);
        return event;
    },

    deleteEvent(eventId) {
        const events = this.getEvents().filter(e => e.eventId !== eventId);
        this._saveLocal(events);
        this._push(events);
    },

    /**
     * 룰렛 후보 추출
     * incomeDb 정산서에서 해당 주차+권역 기록이 있는 라이더 전원 반환
     */
    getRouletteCandidates(weekLabel, region, acceptRateMin, excludeIds) {
        const settlements = incomeDb.getSettlements().filter(b => {
            const weekMatch = !weekLabel || b.weekLabel === weekLabel;
            const regionMatch = !region || region === '전체' || b.region === region;
            return weekMatch && regionMatch;
        });

        const riderMap = {};
        settlements.forEach(batch => {
            (batch.records || []).forEach(rec => {
                if (!rec.riderId && !rec.name) return;
                const key = rec.riderId || rec.name;
                if (!riderMap[key]) {
                    riderMap[key] = {
                        riderId: rec.riderId || key,
                        name: rec.name || '(이름없음)',
                        deliveries: 0,
                        amount: 0,
                        acceptRate: rec.acceptRate || null
                    };
                }
                riderMap[key].deliveries += 1;
                riderMap[key].amount += (rec.amount || 0);
                if (rec.acceptRate) riderMap[key].acceptRate = rec.acceptRate;
            });
        });

        let candidates = Object.values(riderMap);

        // 수락률 게이트
        if (acceptRateMin > 0) {
            candidates = candidates.filter(r =>
                r.acceptRate === null || r.acceptRate >= acceptRateMin
            );
        }

        // 이전 당첨자 제외
        if (excludeIds && excludeIds.length > 0) {
            candidates = candidates.filter(r => !excludeIds.includes(r.riderId));
        }

        return candidates;
    },

    /** 랭킹 집계 (건수 내림차순) */
    getRanking(weekLabel, region, acceptRateMin, excludeIds, topN = 10) {
        return this.getRouletteCandidates(weekLabel, region, acceptRateMin, excludeIds)
            .sort((a, b) => b.deliveries - a.deliveries)
            .slice(0, topN);
    },

    getUniqueRegions() {
        const set = new Set(incomeDb.getSettlements().map(b => b.region).filter(Boolean));
        return ['전체', ...set];
    }
};
