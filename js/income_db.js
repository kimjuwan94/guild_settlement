/**
 * =====================================================
 *  INCOME MANAGER DB - 소득신고 정산 관리 전용 데이터 모듈
 *  ★ Firebase Realtime DB + localStorage 이중 저장 ★
 *  기존 db.js와 완전히 독립. 절대 기존 데이터를 수정하지 않음.
 * =====================================================
 */
const incomeDb = {
    _riderKey:      'income_riders_v1',
    _settlementKey: 'income_settlements_v1',

    // 길드 시스템과 같은 Firebase 프로젝트, 별도 경로 사용
    _firebaseRiderUrl:      'https://floche-gm-default-rtdb.firebaseio.com/income_riders.json',
    _firebaseSettlementUrl: 'https://floche-gm-default-rtdb.firebaseio.com/income_settlements.json',

    _loadingPromise: null, // 중복 로드 방지

    // ── 초기화: 서버에서 데이터 로드 ─────────────────────────
    async loadFromServer() {
        if (this._loadingPromise) return this._loadingPromise;

        this._loadingPromise = (async () => {
            try {
                const [riderRes, settlementRes] = await Promise.all([
                    fetch(this._firebaseRiderUrl),
                    fetch(this._firebaseSettlementUrl)
                ]);

                const cloudRiders      = await riderRes.json();
                const cloudSettlements = await settlementRes.json();

                // Firebase는 null을 반환할 수 있음
                const riders      = Array.isArray(cloudRiders)      ? cloudRiders      : [];
                const settlements = Array.isArray(cloudSettlements) ? cloudSettlements : [];

                // 로컬 백업도 병합 (클라우드가 비어있을 때 로컬 데이터 복구)
                const localRiders      = this._getLocal(this._riderKey);
                const localSettlements = this._getLocal(this._settlementKey);

                const mergedRiders = this._mergeById(riders, localRiders);
                const mergedSettlements = this._mergeById(settlements, localSettlements, 'batchId');

                // 메모리 및 로컬 저장
                this._saveLocal(this._riderKey, mergedRiders);
                this._saveLocal(this._settlementKey, mergedSettlements);

                // 병합 결과를 Firebase에도 다시 저장 (로컬에만 있던 데이터 업로드)
                if (mergedRiders.length > riders.length || mergedSettlements.length > settlements.length) {
                    await this._pushToCloud();
                }

                console.log(`[incomeDb] 로드 완료 - 라이더 ${mergedRiders.length}명, 정산 ${mergedSettlements.length}건`);
            } catch (e) {
                console.warn('[incomeDb] Firebase 로드 실패, 로컬 데이터 사용:', e.message);
            }
        })();

        return this._loadingPromise;
    },

    // ── 내부 헬퍼 ─────────────────────────────────────────────
    _getLocal(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _saveLocal(key, data) {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    },

    _mergeById(cloud, local, idField = 'id') {
        const merged = [...cloud];
        (local || []).forEach(item => {
            if (!merged.find(c => c[idField] === item[idField])) {
                merged.push(item);
            }
        });
        return merged;
    },

    async _pushToCloud() {
        const riders      = this._getLocal(this._riderKey);
        const settlements = this._getLocal(this._settlementKey);
        try {
            await Promise.all([
                fetch(this._firebaseRiderUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(riders)
                }),
                fetch(this._firebaseSettlementUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settlements)
                })
            ]);
        } catch (e) {
            console.error('[incomeDb] Firebase 저장 실패:', e.message);
        }
    },

    // ── 라이더 CRUD ─────────────────────────────────────────

    getRiders() {
        return this._getLocal(this._riderKey);
    },

    saveRiders(riders) {
        this._saveLocal(this._riderKey, riders);
        this._pushToCloud(); // 비동기 클라우드 동기화
    },

    addRider(rider) {
        const riders = this.getRiders();
        // 중복 방지 (이름 + 전화번호 기준)
        const dup = riders.find(r =>
            r.name.trim() === rider.name.trim() &&
            r.phone.replace(/-/g,'') === rider.phone.replace(/-/g,'')
        );
        if (dup) throw new Error(`이미 등록된 라이더입니다: ${rider.name}`);

        const newRider = {
            id: 'R_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: rider.name.trim(),
            phone: rider.phone.trim(),
            residentNo: (rider.residentNo || '').trim(),
            baeminId: (rider.baeminId || '').trim(),
            coupangLast4: (rider.coupangLast4 || '').trim(),
            registeredAt: new Date().toISOString()
        };
        riders.push(newRider);
        this.saveRiders(riders);
        return newRider;
    },

    updateRider(id, fields) {
        const riders = this.getRiders();
        const idx = riders.findIndex(r => r.id === id);
        if (idx === -1) return false;
        riders[idx] = { ...riders[idx], ...fields, updatedAt: new Date().toISOString() };
        this.saveRiders(riders);
        return true;
    },

    deleteRider(id) {
        const riders = this.getRiders().filter(r => r.id !== id);
        this.saveRiders(riders);
    },

    bulkAddRiders(riderList) {
        const results = { added: 0, updated: [], skipped: [], errors: [] };

        // ★ STEP 1: 엑셀 내 동일인 행 사전 병합
        const mergeKey = r => {
            const name     = (r.name || '').trim();
            const phone    = (r.phone || '').replace(/-/g, '').trim();
            const resident = (r.residentNo || '').replace(/-/g, '').trim();
            return `${name}|${resident || phone}`;
        };

        const mergedMap = {};
        riderList.forEach(r => {
            const key = mergeKey(r);
            if (!mergedMap[key]) {
                mergedMap[key] = { ...r };
            } else {
                const m = mergedMap[key];
                if (!m.baeminId     && r.baeminId)     m.baeminId     = r.baeminId.trim();
                if (!m.coupangLast4 && r.coupangLast4) m.coupangLast4 = r.coupangLast4.trim();
                if (!m.residentNo   && r.residentNo)   m.residentNo   = r.residentNo.trim();
                if (!m.phone        && r.phone)         m.phone        = r.phone.trim();
            }
        });
        const mergedList = Object.values(mergedMap);

        // ★ STEP 2: 병합된 목록으로 DB 등록/업데이트
        mergedList.forEach(r => {
            try {
                const existing = this.getRiders().find(ex => {
                    const sameName     = ex.name.trim() === (r.name||'').trim();
                    const samePhone    = ex.phone.replace(/-/g,'') === (r.phone||'').replace(/-/g,'');
                    const sameResident = r.residentNo &&
                        ex.residentNo.replace(/-/g,'') === r.residentNo.replace(/-/g,'');
                    return sameName && (samePhone || sameResident);
                });

                if (existing) {
                    const updates = {};
                    if (!existing.baeminId     && r.baeminId)     updates.baeminId     = r.baeminId.trim();
                    if (!existing.coupangLast4 && r.coupangLast4) updates.coupangLast4 = r.coupangLast4.trim();
                    if (!existing.residentNo   && r.residentNo)   updates.residentNo   = r.residentNo.trim();

                    if (Object.keys(updates).length > 0) {
                        this.updateRider(existing.id, updates);
                        results.updated.push({ name: r.name, fields: Object.keys(updates).join(', ') });
                    } else {
                        results.skipped.push({ name: r.name, reason: '동일한 정보 이미 등록됨' });
                    }
                } else {
                    this.addRider(r);
                    results.added++;
                }
            } catch (e) {
                results.errors.push({ name: r.name, reason: e.message });
            }
        });

        return results;
    },

    // ── 정산 데이터 CRUD ──────────────────────────────────

    getSettlements() {
        return this._getLocal(this._settlementKey);
    },

    saveSettlements(settlements) {
        this._saveLocal(this._settlementKey, settlements);
        this._pushToCloud(); // 비동기 클라우드 동기화
    },

    /**
     * 정산 업로드 배치 추가
     */
    addSettlementBatch(platform, weekLabel, records, region = '') {
        const settlements = this.getSettlements();
        const batchId = 'B_' + Date.now();
        const batch = {
            batchId,
            platform,
            weekLabel,
            region: region.trim(),
            uploadedAt: new Date().toISOString(),
            records
        };
        settlements.push(batch);
        this.saveSettlements(settlements);
        return batch;
    },

    deleteSettlementBatch(batchId) {
        const settlements = this.getSettlements().filter(b => b.batchId !== batchId);
        this.saveSettlements(settlements);
    },

    // ── 집계 헬퍼 ─────────────────────────────────────────

    getSummaryByRider() {
        const riders = this.getRiders();
        const settlements = this.getSettlements();
        const map = {};
        riders.forEach(r => { map[r.id] = { baemin: 0, coupang: 0 }; });
        settlements.forEach(batch => {
            batch.records.forEach(rec => {
                if (rec.riderId && map[rec.riderId] !== undefined) {
                    if (batch.platform === 'baemin') map[rec.riderId].baemin += (rec.amount || 0);
                    else map[rec.riderId].coupang += (rec.amount || 0);
                }
            });
        });
        return riders.map(r => ({
            riderId: r.id, name: r.name, phone: r.phone,
            residentNo: r.residentNo, baeminId: r.baeminId, coupangLast4: r.coupangLast4,
            baemin:  map[r.id]?.baemin  || 0,
            coupang: map[r.id]?.coupang || 0,
            total:  (map[r.id]?.baemin  || 0) + (map[r.id]?.coupang || 0)
        }));
    },

    getSummaryByRiderFiltered(weekLabels) {
        const riders = this.getRiders();
        const settlements = this.getSettlements().filter(b =>
            !weekLabels || weekLabels.includes(b.weekLabel)
        );
        const map = {};
        riders.forEach(r => { map[r.id] = { baemin: 0, coupang: 0 }; });
        settlements.forEach(batch => {
            batch.records.forEach(rec => {
                if (rec.riderId && map[rec.riderId] !== undefined) {
                    if (batch.platform === 'baemin') map[rec.riderId].baemin += (rec.amount || 0);
                    else map[rec.riderId].coupang += (rec.amount || 0);
                }
            });
        });
        return riders.map(r => ({
            riderId: r.id, name: r.name, phone: r.phone,
            residentNo: r.residentNo, baeminId: r.baeminId, coupangLast4: r.coupangLast4,
            baemin:  map[r.id]?.baemin  || 0,
            coupang: map[r.id]?.coupang || 0,
            total:  (map[r.id]?.baemin  || 0) + (map[r.id]?.coupang || 0)
        }));
    },

    getUniqueWeekLabels() {
        const set = new Set(this.getSettlements().map(b => b.weekLabel));
        return [...set].sort().reverse();
    }
};
