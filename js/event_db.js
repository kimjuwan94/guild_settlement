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
            const [r1, r2] = await Promise.all([
                fetch(this._firebaseUrl),
                fetch(this._fbSettleUrl)
            ]);
            const events   = await r1.json();
            const settles  = await r2.json();
            this._saveLocal(this._localKey,   Array.isArray(events)  ? events  : []);
            this._saveLocal(this._settleKey,  Array.isArray(settles) ? settles : []);
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
    addEventSettlementBatch(platform, weekLabel, region, records) {
        const settles = this.getEventSettlements();
        const batch = {
            batchId:    'EB_' + Date.now(),
            platform,
            weekLabel,
            region:     region.trim(),
            uploadedAt: new Date().toISOString(),
            records
        };
        settles.push(batch);
        this._saveLocal(this._settleKey, settles);
        this._push(this._fbSettleUrl, settles);
        return batch;
    },

    deleteEventSettlementBatch(batchId) {
        const settles = this.getEventSettlements().filter(b => b.batchId !== batchId);
        this._saveLocal(this._settleKey, settles);
        this._push(this._fbSettleUrl, settles);
    },

    // ── 룰렛 후보 추출 (이벤트 전용 정산서 기준) ──────────
    getRouletteCandidates(weekLabel, region, acceptRateMin, excludeIds) {
        const settles = this.getEventSettlements().filter(b => {
            const wm = !weekLabel || b.weekLabel === weekLabel;
            const rm = !region   || region === '전체' || b.region === region;
            return wm && rm;
        });

        const riderMap = {};
        settles.forEach(batch => {
            (batch.records || []).forEach(rec => {
                if (!rec.riderId && !rec.name) return;
                const key = rec.riderId || rec.name;
                if (!riderMap[key]) {
                    riderMap[key] = { riderId: key, name: rec.name || key, deliveries: 0, amount: 0, acceptRate: null };
                }
                riderMap[key].deliveries += 1;
                riderMap[key].amount     += (rec.amount || 0);
                if (rec.acceptRate != null) riderMap[key].acceptRate = rec.acceptRate;
            });
        });

        let candidates = Object.values(riderMap);
        if (acceptRateMin > 0)
            candidates = candidates.filter(r => r.acceptRate === null || r.acceptRate >= acceptRateMin);
        if (excludeIds && excludeIds.length > 0)
            candidates = candidates.filter(r => !excludeIds.includes(r.riderId));
        return candidates;
    },

    /** 랭킹 집계 */
    getRanking(weekLabel, region, acceptRateMin, excludeIds, topN = 10) {
        return this.getRouletteCandidates(weekLabel, region, acceptRateMin, excludeIds)
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
