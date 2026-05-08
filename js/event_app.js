/**
 * 이벤트/추첨 관리 UI 모듈 (Admin 전용)
 * - 룰렛 추첨기 (Canvas 애니메이션)
 * - 랭킹 보드
 * - 보상 주정산 연동
 */
const eventApp = {
    _tab: 'upload',         // 'upload' | 'roulette' | 'ranking' | 'history'
    _pool: [],               // 현재 룰렛 후보 목록
    _winners: [],            // 이번 세션 당첨자
    _spinAngle: 0,
    _isSpinning: false,
    _pendingEventId: null,

    render(container) {
        const tabs = [
            { id: 'upload',   label: '📤 정산서 업로드' },
            { id: 'roulette', label: '🎡 룰렛 추첨기' },
            { id: 'ranking',  label: '🏆 랭킹 보드' },
            { id: 'history',  label: '📋 이벤트 내역' },
        ];
        const tabHtml = tabs.map(t => `
            <button onclick="eventApp._tab='${t.id}';eventApp.render(document.getElementById('app-content'))"
                class="px-4 py-2 text-sm font-bold rounded-lg transition-all ${this._tab === t.id
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}">
                ${t.label}
            </button>`).join('');

        let body = '';
        if      (this._tab === 'upload')   body = this._renderUpload();
        else if (this._tab === 'roulette') body = this._renderRoulette();
        else if (this._tab === 'ranking')  body = this._renderRanking();
        else                               body = this._renderHistory();

        container.innerHTML = `
            <div class="max-w-6xl mx-auto">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-black text-gray-900">이벤트 / 추첨 관리</h2>
                        <p class="text-sm text-gray-500 mt-1">관리자 전용 — 룰렛 추첨 및 랭킹 집계</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mb-6">${tabHtml}</div>
                <div id="event-body">${body}</div>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (this._tab === 'roulette' && this._pool.length > 0) this._redraw();
    },

    // ── 정산서 업로드 탭 ───────────────────────────────────
    _renderUpload() {
        const batches  = eventDb.getEventSettlements();
        const batchRows = batches.slice().reverse().map(b => {
            const platBadge = b.platform === 'baemin'
                ? '<span class="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-bold rounded">배민</span>'
                : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">쿠팡</span>';
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
                    <td class="py-2 px-4">${platBadge}</td>
                    <td class="py-2 px-4 font-medium">${b.weekLabel}</td>
                    <td class="py-2 px-4">${b.region || '-'}</td>
                    <td class="py-2 px-4 text-center">${(b.records||[]).length}명</td>
                    <td class="py-2 px-4 text-xs text-gray-400">${new Date(b.uploadedAt).toLocaleString()}</td>
                    <td class="py-2 px-4 text-right">
                        <button onclick="eventApp._deleteBatch('${b.batchId}')"
                            class="text-red-400 hover:text-red-600 text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50">삭제</button>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                <!-- 배민 업로드 -->
                <div class="glass-panel rounded-xl border border-teal-200 p-6 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                    <h3 class="font-bold text-gray-800 mb-1 flex items-center">
                        <i data-lucide="bike" class="w-5 h-5 mr-2 text-teal-600"></i> 배민 정산서 업로드
                    </h3>
                    <p class="text-xs text-gray-500 mb-4">이벤트 전용 — 소득신고 정산과 별도 저장됩니다.</p>
                    <div class="space-y-2 mb-4">
                        <input type="text" id="ev-up-week-b" placeholder="주차 (예: 2026-05-1)"
                            class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
                        <input type="text" id="ev-up-region-b" placeholder="권역 (예: 김해북부)"
                            class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none">
                        <input type="file" id="ev-file-b" accept=".xlsx,.xls" multiple
                            class="w-full text-sm border rounded-lg px-3 py-2">
                    </div>
                    <button onclick="eventApp._parseAndUpload('baemin')"
                        class="w-full bg-teal-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-teal-700 transition-all">
                        파일 파싱 및 이벤트 DB 저장
                    </button>
                </div>

                <!-- 쿠팡 업로드 -->
                <div class="glass-panel rounded-xl border border-red-200 p-6 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                    <h3 class="font-bold text-gray-800 mb-1 flex items-center">
                        <i data-lucide="truck" class="w-5 h-5 mr-2 text-red-600"></i> 쿠팡 정산서 업로드
                    </h3>
                    <p class="text-xs text-gray-500 mb-4">이벤트 전용 — 소득신고 정산과 별도 저장됩니다.</p>
                    <div class="space-y-2 mb-4">
                        <input type="text" id="ev-up-week-c" placeholder="주차 (예: 2026-05-1)"
                            class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
                        <input type="text" id="ev-up-region-c" placeholder="권역 (예: 김해북부)"
                            class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
                        <input type="file" id="ev-file-c" accept=".xlsx,.xls" multiple
                            class="w-full text-sm border rounded-lg px-3 py-2">
                    </div>
                    <button onclick="eventApp._parseAndUpload('coupang')"
                        class="w-full bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 transition-all">
                        파일 파싱 및 이벤트 DB 저장
                    </button>
                </div>
            </div>

            <!-- 업로드 내역 -->
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <h3 class="font-bold text-gray-800 mb-4">이벤트 정산서 업로드 내역 (${batches.length}건)</h3>
                ${batches.length === 0
                    ? '<p class="text-center text-gray-400 text-sm py-6">업로드된 이벤트 정산서가 없습니다.</p>'
                    : `<div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 text-xs uppercase text-gray-500">
                                <tr>
                                    <th class="py-2 px-4">플랫폼</th>
                                    <th class="py-2 px-4">주차</th>
                                    <th class="py-2 px-4">권역</th>
                                    <th class="py-2 px-4 text-center">인원</th>
                                    <th class="py-2 px-4">업로드 시각</th>
                                    <th class="py-2 px-4"></th>
                                </tr>
                            </thead>
                            <tbody>${batchRows}</tbody>
                        </table>
                    </div>`
                }
            </div>`;
    },

    // ── 룰렛 탭 ─────────────────────────────────────────────
    _renderRoulette() {
        const weeks   = eventDb.getUniqueWeeks();
        const regions = eventDb.getUniqueRegions();
        const weekOpts = weeks.map(w => `<option value="${w}">${w}</option>`).join('');
        const regionOpts = regions.map(r => `<option value="${r}">${r}</option>`).join('');

        const winnerRows = this._winners.map((w, i) => `
            <div class="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded-lg mb-1 border border-yellow-200">
                <span class="font-bold text-yellow-800">${i + 1}등 🏆 ${w.name}</span>
                <span class="text-xs text-yellow-600">${w.deliveries}콜</span>
            </div>`).join('');

        const poolRows = this._pool.map(r => `
            <div class="flex justify-between py-1 px-2 text-sm border-b border-gray-50">
                <span class="text-gray-700">${r.name}</span>
                <span class="text-xs text-gray-400">${r.deliveries}콜</span>
            </div>`).join('');

        return `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- 설정 패널 -->
                <div class="lg:col-span-1 space-y-4">
                    <div class="glass-panel rounded-xl border border-purple-100 p-5">
                        <h3 class="font-bold text-gray-800 mb-4 flex items-center">
                            <i data-lucide="settings" class="w-4 h-4 mr-2 text-purple-600"></i> 추첨 설정
                        </h3>
                        <div class="space-y-3">
                            <div>
                                <label class="text-xs font-bold text-gray-500 mb-1 block">대상 주차</label>
                                <select id="ev-week" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                                    <option value="">-- 주차 선택 --</option>${weekOpts}
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-bold text-gray-500 mb-1 block">권역</label>
                                <select id="ev-region" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                                    ${regionOpts}
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-bold text-gray-500 mb-1 block">수락률 하한 (%)</label>
                                <input type="number" id="ev-accept" value="0" min="0" max="100"
                                    class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                    placeholder="0 = 전체 포함">
                            </div>
                            <div>
                                <label class="text-xs font-bold text-gray-500 mb-1 block">보상금액 (원)</label>
                                <input type="number" id="ev-amount" value="100000" min="0"
                                    class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                            </div>
                            <div>
                                <label class="text-xs font-bold text-gray-500 mb-1 block">보상 항목명</label>
                                <input type="text" id="ev-label" value="주유 지원금"
                                    class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                            </div>
                            <button onclick="eventApp._loadPool()"
                                class="w-full bg-purple-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 transition-all">
                                후보 불러오기
                            </button>
                        </div>
                    </div>

                    <!-- 후보 목록 -->
                    <div class="glass-panel rounded-xl border border-gray-100 p-5">
                        <h4 class="font-bold text-gray-700 mb-3 text-sm">
                            후보 목록 <span class="text-purple-600">(${this._pool.length}명)</span>
                        </h4>
                        <div class="max-h-48 overflow-y-auto">${poolRows || '<p class="text-xs text-gray-400 text-center py-4">설정 후 후보를 불러오세요</p>'}</div>
                    </div>

                    <!-- 당첨자 목록 -->
                    ${this._winners.length > 0 ? `
                    <div class="glass-panel rounded-xl border border-yellow-200 p-5 bg-yellow-50">
                        <h4 class="font-bold text-yellow-800 mb-3 text-sm">이번 추첨 당첨자</h4>
                        ${winnerRows}
                        <button onclick="eventApp._confirmRewards()"
                            class="w-full mt-3 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-all">
                            ✅ 보상 확정 → 이벤트 기록 저장
                        </button>
                    </div>` : ''}
                </div>

                <!-- 룰렛 캔버스 -->
                <div class="lg:col-span-2">
                    <div class="glass-panel rounded-xl border border-gray-100 p-6 flex flex-col items-center">
                        <div class="relative">
                            <canvas id="roulette-canvas" width="420" height="420"
                                class="rounded-full shadow-2xl" style="max-width:100%"></canvas>
                        </div>
                        <div class="mt-6 flex gap-3 w-full max-w-sm">
                            <button id="btn-spin" onclick="eventApp._spin()"
                                class="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black rounded-xl text-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
                                ${this._pool.length === 0 ? 'disabled' : ''}>
                                🎡 추첨하기
                            </button>
                            <button onclick="eventApp._resetSession()"
                                class="px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-200 transition-all">
                                초기화
                            </button>
                        </div>
                        <p id="spin-result" class="mt-4 text-lg font-black text-purple-700 hidden"></p>
                    </div>
                </div>
            </div>`;
    },

    // ── 랭킹 탭 ─────────────────────────────────────────────
    _renderRanking() {
        const weeks   = eventDb.getUniqueWeeks();
        const regions = eventDb.getUniqueRegions();
        return `
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <div class="flex flex-wrap gap-3 mb-6">
                    <select id="rank-week" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none">
                        <option value="">-- 주차 선택 --</option>
                        ${weeks.map(w => `<option value="${w}">${w}</option>`).join('')}
                    </select>
                    <select id="rank-region" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none">
                        ${regions.map(r => `<option value="${r}">${r}</option>`).join('')}
                    </select>
                    <input type="number" id="rank-accept" value="0" min="0" max="100" placeholder="수락률 하한(%)"
                        class="w-32 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none">
                    <button onclick="eventApp._loadRanking()"
                        class="bg-yellow-500 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-yellow-600 transition-all">
                        랭킹 조회
                    </button>
                </div>
                <div id="ranking-result">
                    <p class="text-center text-gray-400 py-10 text-sm">위 조건 선택 후 [랭킹 조회]를 누르세요.</p>
                </div>
            </div>`;
    },

    // ── 이벤트 내역 탭 ───────────────────────────────────────
    _renderHistory() {
        const events = eventDb.getEvents();
        if (events.length === 0) return `
            <div class="glass-panel rounded-xl p-12 text-center text-gray-400">
                <i data-lucide="calendar-x" class="w-12 h-12 mx-auto mb-4 text-gray-300"></i>
                <p class="font-bold">저장된 이벤트 내역이 없습니다.</p>
            </div>`;

        const rows = events.map(ev => {
            const badge = ev.status === 'rewarded'
                ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">보상완료</span>'
                : '<span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">진행중</span>';
            const winnerStr = ev.winners.map(w => w.name).join(', ') || '(미확정)';
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-3 px-4 text-sm font-medium">${ev.weekLabel || '-'}</td>
                    <td class="py-3 px-4 text-sm">${ev.region || '전체'}</td>
                    <td class="py-3 px-4 text-sm">${ev.rewardLabel} ${ev.rewardAmount.toLocaleString()}원</td>
                    <td class="py-3 px-4 text-sm text-yellow-700 font-bold">${winnerStr}</td>
                    <td class="py-3 px-4">${badge}</td>
                    <td class="py-3 px-4">
                        <button onclick="eventApp._deleteEvent('${ev.eventId}')"
                            class="text-xs text-red-400 hover:text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50">삭제</button>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <h3 class="font-bold text-gray-800 mb-4">이벤트 기록 (${events.length}건)</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th class="py-3 px-4">주차</th>
                                <th class="py-3 px-4">권역</th>
                                <th class="py-3 px-4">보상</th>
                                <th class="py-3 px-4">당첨자</th>
                                <th class="py-3 px-4">상태</th>
                                <th class="py-3 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    },

    // ── 액션 ────────────────────────────────────────────────
    _loadPool() {
        const week   = document.getElementById('ev-week')?.value || '';
        const region = document.getElementById('ev-region')?.value || '전체';
        const accept = parseFloat(document.getElementById('ev-accept')?.value || '0');

        if (!week) { alert('대상 주차를 선택하세요.'); return; }

        this._winners = [];
        this._spinAngle = 0;
        this._pool = eventDb.getRouletteCandidates(week, region, accept, []);

        if (this._pool.length === 0) {
            alert('해당 조건의 후보가 없습니다.\n정산서가 업로드되어 있는지 확인하세요.');
            return;
        }

        this.render(document.getElementById('app-content'));
    },

    _loadRanking() {
        const week   = document.getElementById('rank-week')?.value || '';
        const region = document.getElementById('rank-region')?.value || '전체';
        const accept = parseFloat(document.getElementById('rank-accept')?.value || '0');

        if (!week) { alert('주차를 선택하세요.'); return; }

        const ranking = eventDb.getRanking(week, region, accept, []);
        const resultDiv = document.getElementById('ranking-result');
        if (!resultDiv) return;

        if (ranking.length === 0) {
            resultDiv.innerHTML = '<p class="text-center text-gray-400 py-10 text-sm">해당 조건의 데이터가 없습니다.</p>';
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        const rows = ranking.map((r, i) => `
            <tr class="border-b border-gray-100 hover:bg-yellow-50 transition-colors">
                <td class="py-3 px-4 text-lg">${medals[i] || `${i+1}위`}</td>
                <td class="py-3 px-4 font-bold text-gray-800">${r.name}</td>
                <td class="py-3 px-4 text-blue-700 font-bold text-center">${r.deliveries}콜</td>
                <td class="py-3 px-4 text-xs text-gray-400">${r.acceptRate !== null ? r.acceptRate + '%' : '-'}</td>
            </tr>`).join('');

        resultDiv.innerHTML = `
            <table class="w-full text-left text-sm">
                <thead class="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                        <th class="py-3 px-4">순위</th>
                        <th class="py-3 px-4">라이더</th>
                        <th class="py-3 px-4 text-center">수행 콜 수</th>
                        <th class="py-3 px-4">수락률</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    },

    _deleteBatch(batchId) {
        if (!confirm('이 정산서를 삭제하시겠습니까?')) return;
        eventDb.deleteEventSettlementBatch(batchId);
        this.render(document.getElementById('app-content'));
    },

    async _parseAndUpload(platform) {
        const suffix = platform === 'baemin' ? 'b' : 'c';
        const weekEl   = document.getElementById(`ev-up-week-${suffix}`);
        const regionEl = document.getElementById(`ev-up-region-${suffix}`);
        const fileEl   = document.getElementById(`ev-file-${suffix}`);

        const weekLabel = (weekEl?.value || '').trim();
        const region    = (regionEl?.value || '').trim();
        const files     = fileEl ? Array.from(fileEl.files) : [];

        if (!weekLabel) { alert('주차를 입력하세요. (예: 2026-05-1)'); return; }
        if (!region)    { alert('권역을 입력하세요. (예: 김해북부)'); return; }
        if (files.length === 0) { alert('파일을 선택하세요.'); return; }

        let totalAdded = 0;
        for (const file of files) {
            try {
                let records;
                if (platform === 'baemin') {
                    records = await IncomeExcelParser.parseBaemin(file, [], weekLabel);
                } else {
                    records = await IncomeExcelParser.parseCoupang(file, [], weekLabel);
                }
                if (records && records.length > 0) {
                    eventDb.addEventSettlementBatch(platform, weekLabel, region, records);
                    totalAdded += records.length;
                }
            } catch (err) {
                console.error('[eventApp] parse error:', err);
                alert(`파일 파싱 오류: ${file.name}\n${err.message}`);
            }
        }

        if (totalAdded > 0) {
            alert(`✅ 업로드 완료!\n${files.length}개 파일 → ${totalAdded}명 데이터 이벤트 DB에 저장`);
            this.render(document.getElementById('app-content'));
        } else {
            alert('유효한 데이터가 없습니다. 파일 형식을 확인하세요.');
        }
    },

    _resetSession() {
        this._pool = [];
        this._winners = [];
        this._spinAngle = 0;
        this.render(document.getElementById('app-content'));
    },

    _deleteEvent(eventId) {
        if (!confirm('이 이벤트 기록을 삭제하시겠습니까?')) return;
        eventDb.deleteEvent(eventId);
        this.render(document.getElementById('app-content'));
    },

    // ── 룰렛 캔버스 ─────────────────────────────────────────
    _COLORS: [
        '#7C3AED','#2563EB','#059669','#D97706','#DC2626',
        '#7C3AED','#0891B2','#65A30D','#EA580C','#9333EA'
    ],

    _redraw() {
        const canvas = document.getElementById('roulette-canvas');
        if (!canvas) return;
        this._drawWheel(canvas, this._pool, this._spinAngle);
    },

    _drawWheel(canvas, pool, angle) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const cx = W / 2, cy = H / 2;
        const radius = Math.min(cx, cy) - 15;
        const count = pool.length;

        ctx.clearRect(0, 0, W, H);

        if (count === 0) {
            ctx.fillStyle = '#f3f4f6';
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#9ca3af';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('후보를 불러오세요', cx, cy);
            return;
        }

        const sectorAngle = (2 * Math.PI) / count;

        // 외곽 그림자
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.restore();

        // 섹터 그리기
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        for (let i = 0; i < count; i++) {
            const start = i * sectorAngle - Math.PI / 2;
            const end   = start + sectorAngle;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, start, end);
            ctx.closePath();
            ctx.fillStyle = this._COLORS[i % this._COLORS.length];
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 텍스트
            ctx.save();
            ctx.rotate(start + sectorAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            const fontSize = count > 15 ? 10 : count > 10 ? 12 : 14;
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 3;
            const maxLen = 6;
            const label = pool[i].name.length > maxLen ? pool[i].name.slice(0, maxLen) + '…' : pool[i].name;
            ctx.fillText(label, radius - 12, 4);
            ctx.restore();
        }

        ctx.restore();

        // 중앙 원
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 3;
        ctx.fill(); ctx.stroke();

        // 포인터 (상단 삼각형)
        ctx.beginPath();
        ctx.moveTo(cx - 13, 5);
        ctx.lineTo(cx + 13, 5);
        ctx.lineTo(cx, 40);
        ctx.closePath();
        ctx.fillStyle = '#DC2626';
        ctx.shadowColor = 'rgba(220,38,38,0.5)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
    },

    _spin() {
        if (this._isSpinning || this._pool.length === 0) return;

        const pool = this._pool;
        const count = pool.length;
        const sectorAngle = (2 * Math.PI) / count;

        // 당첨자 사전 선택
        const winnerIdx = Math.floor(Math.random() * count);

        // 현재 각도 기준으로 당첨 섹터를 포인터(상단)에 위치시키는 목표 각도 계산
        const currentMod = ((this._spinAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const targetMod  = ((2 * Math.PI - (winnerIdx + 0.5) * sectorAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        let delta = targetMod - currentMod;
        if (delta <= 0) delta += 2 * Math.PI;

        const extraRotations = (5 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
        const totalRotation  = extraRotations + delta;
        const startAngle     = this._spinAngle;
        const endAngle       = startAngle + totalRotation;
        const duration       = 4500 + Math.random() * 1000;
        const startTime      = performance.now();

        const canvas = document.getElementById('roulette-canvas');
        document.getElementById('spin-result')?.classList.add('hidden');
        document.getElementById('btn-spin').disabled = true;
        this._isSpinning = true;

        const easeOut = t => 1 - Math.pow(1 - t, 4);

        const animate = (now) => {
            const t = Math.min((now - startTime) / duration, 1);
            this._spinAngle = startAngle + totalRotation * easeOut(t);
            this._drawWheel(canvas, pool, this._spinAngle);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this._spinAngle = endAngle;
                this._isSpinning = false;
                this._onWin(winnerIdx);
            }
        };
        requestAnimationFrame(animate);
    },

    _onWin(winnerIdx) {
        const winner = this._pool[winnerIdx];

        // 당첨자를 풀에서 제거 (중복 방지)
        this._pool = this._pool.filter((_, i) => i !== winnerIdx);
        this._winners.push(winner);

        const resultEl = document.getElementById('spin-result');
        if (resultEl) {
            resultEl.textContent = `🎉 당첨: ${winner.name} (${winner.deliveries}콜)`;
            resultEl.classList.remove('hidden');
        }

        document.getElementById('btn-spin').disabled = this._pool.length === 0;

        // 당첨자 패널 업데이트
        this.render(document.getElementById('app-content'));
    },

    _confirmRewards() {
        if (this._winners.length === 0) return;

        const week   = document.getElementById('ev-week')?.value || '';
        const region = document.getElementById('ev-region')?.value || '전체';
        const amount = parseInt(document.getElementById('ev-amount')?.value || '0');
        const label  = document.getElementById('ev-label')?.value || '이벤트 당첨금';

        const event = eventDb.createEvent({
            weekLabel: week, region, rewardAmount: amount, rewardLabel: label,
            title: `${week} ${region} 룰렛 추첨`
        });

        this._winners.forEach((w, i) => {
            eventDb.addWinner(event.eventId, {
                riderId: w.riderId, name: w.name,
                rank: i + 1, deliveries: w.deliveries,
                rewardAmount: amount, rewardLabel: label
            });
        });

        eventDb.confirmRewards(event.eventId);

        alert(`✅ 보상 확정 완료!\n당첨자 ${this._winners.length}명 → 이벤트 기록에 저장되었습니다.\n\n당첨자: ${this._winners.map(w => w.name).join(', ')}`);

        this._winners = [];
        this._pool    = [];
        this._spinAngle = 0;
        this._tab = 'history';
        this.render(document.getElementById('app-content'));
    }
};
