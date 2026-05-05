/**
 * =====================================================
 *  INCOME MANAGER DB - 소득신고 정산 관리 전용 데이터 모듈
 *  기존 db.js와 완전히 독립. 절대 기존 데이터를 수정하지 않음.
 * =====================================================
 */
const incomeDb = {
    _riderKey: 'income_riders_v1',
    _settlementKey: 'income_settlements_v1',

    // ── 라이더 CRUD ─────────────────────────────────────

    getRiders() {
        try {
            const raw = localStorage.getItem(this._riderKey);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('[incomeDb] getRiders error:', e);
            return [];
        }
    },

    saveRiders(riders) {
        try {
            localStorage.setItem(this._riderKey, JSON.stringify(riders));
        } catch (e) {
            console.error('[incomeDb] saveRiders error:', e);
        }
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
            residentNo: rider.residentNo.trim(), // 주민번호
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
        const results = { added: 0, skipped: [], errors: [] };
        riderList.forEach(r => {
            try {
                this.addRider(r);
                results.added++;
            } catch (e) {
                results.skipped.push({ name: r.name, reason: e.message });
            }
        });
        return results;
    },

    // ── 정산 데이터 CRUD ──────────────────────────────────

    getSettlements() {
        try {
            const raw = localStorage.getItem(this._settlementKey);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('[incomeDb] getSettlements error:', e);
            return [];
        }
    },

    saveSettlements(settlements) {
        try {
            localStorage.setItem(this._settlementKey, JSON.stringify(settlements));
        } catch (e) {
            console.error('[incomeDb] saveSettlements error:', e);
        }
    },

    /**
     * 정산 업로드 배치 추가
     * @param {string} platform - 'baemin' | 'coupang'
     * @param {string} weekLabel - '2026-05-01' 등 주차 식별자
     * @param {Array}  records   - [{ riderId, name, amount }]
     */
    addSettlementBatch(platform, weekLabel, records, region = '') {
        const settlements = this.getSettlements();
        const batchId = 'B_' + Date.now();
        const batch = {
            batchId,
            platform,
            weekLabel,
            region: region.trim(),   // ★ 권역 정보
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

    /**
     * 라이더별 플랫폼별 합산 금액 반환
     * @returns {Array} [{ riderId, name, baemin, coupang, total }]
     */
    getSummaryByRider() {
        const riders = this.getRiders();
        const settlements = this.getSettlements();

        const map = {};  // riderId → { baemin, coupang }

        riders.forEach(r => {
            map[r.id] = { baemin: 0, coupang: 0 };
        });

        settlements.forEach(batch => {
            batch.records.forEach(rec => {
                if (rec.riderId && map[rec.riderId] !== undefined) {
                    if (batch.platform === 'baemin') {
                        map[rec.riderId].baemin += (rec.amount || 0);
                    } else {
                        map[rec.riderId].coupang += (rec.amount || 0);
                    }
                }
            });
        });

        return riders.map(r => ({
            riderId: r.id,
            name: r.name,
            phone: r.phone,
            residentNo: r.residentNo,
            baeminId: r.baeminId,
            coupangLast4: r.coupangLast4,
            baemin: map[r.id]?.baemin || 0,
            coupang: map[r.id]?.coupang || 0,
            total: (map[r.id]?.baemin || 0) + (map[r.id]?.coupang || 0)
        }));
    },

    /**
     * 기간(weekLabel) 필터를 적용한 집계
     */
    getSummaryByRiderFiltered(weekLabels) {
        const riders = this.getRiders();
        // weekLabels가 null/undefined → 전체 반환
        // weekLabels가 빈 배열 []  → 0건 반환 (해당 기간 데이터 없음)
        const settlements = this.getSettlements().filter(b =>
            !weekLabels || weekLabels.includes(b.weekLabel)
        );

        const map = {};
        riders.forEach(r => {
            map[r.id] = { baemin: 0, coupang: 0 };
        });

        settlements.forEach(batch => {
            batch.records.forEach(rec => {
                if (rec.riderId && map[rec.riderId] !== undefined) {
                    if (batch.platform === 'baemin') {
                        map[rec.riderId].baemin += (rec.amount || 0);
                    } else {
                        map[rec.riderId].coupang += (rec.amount || 0);
                    }
                }
            });
        });

        return riders.map(r => ({
            riderId: r.id,
            name: r.name,
            phone: r.phone,
            residentNo: r.residentNo,
            baeminId: r.baeminId,
            coupangLast4: r.coupangLast4,
            baemin: map[r.id]?.baemin || 0,
            coupang: map[r.id]?.coupang || 0,
            total: (map[r.id]?.baemin || 0) + (map[r.id]?.coupang || 0)
        }));
    },

    getUniqueWeekLabels() {
        const set = new Set(this.getSettlements().map(b => b.weekLabel));
        return [...set].sort().reverse();
    }
};
