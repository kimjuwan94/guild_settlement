/**
 * 이벤트/추첨 관리 UI 모듈 (Admin 전용)
 * - 룰렛 추첨기 (Canvas 애니메이션)
 * - 랭킹 보드
 * - 보상 주정산 연동
 */
const eventApp = {
    _tab: 'upload',
    _pool: [],
    _winners: [],
    _spinAngle: 0,
    _isSpinning: false,
    _pendingEventId: null,
    _staged: { baemin: [], coupang: [] }, // 드래그&드롭 스테이징 파일

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

    // ── 정산서 업로드 탭 (날짜·권역별 + 드래그&드롭) ────────
    _renderUpload() {
        const batches = eventDb.getEventSettlements();

        // 업로드 내역: 날짜 → 권역 → 플랫폼 그룹핑
        const grouped = {};
        batches.slice().reverse().forEach(b => {
            const dateKey = b.date || b.weekLabel || '-';
            const regKey  = b.region || '-';
            if (!grouped[dateKey]) grouped[dateKey] = {};
            if (!grouped[dateKey][regKey]) grouped[dateKey][regKey] = [];
            grouped[dateKey][regKey].push(b);
        });

        const historyHtml = Object.keys(grouped).length === 0
            ? '<p class="text-center text-gray-400 text-sm py-6">업로드된 이벤트 정산서가 없습니다.</p>'
            : Object.entries(grouped).map(([date, regions]) => `
                <div class="mb-4">
                    <div class="flex items-center mb-2">
                        <i data-lucide="calendar" class="w-4 h-4 mr-2 text-purple-500"></i>
                        <span class="font-bold text-gray-800">${date}</span>
                    </div>
                    ${Object.entries(regions).map(([reg, bs]) => `
                        <div class="ml-6 mb-2">
                            <div class="flex items-center mb-1">
                                <i data-lucide="map-pin" class="w-3 h-3 mr-1 text-gray-400"></i>
                                <span class="text-sm font-bold text-gray-600">${reg}</span>
                            </div>
                            <div class="ml-4 space-y-1">
                                ${bs.map(b => {
                                    const badge = b.platform === 'baemin'
                                        ? '<span class="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-bold rounded">배민</span>'
                                        : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">쿠팡</span>';
                                    return `<div class="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                        <div class="flex items-center gap-2">${badge}
                                            <span class="text-gray-600">${(b.records||[]).length}명</span>
                                            <span class="text-xs text-gray-400">${new Date(b.uploadedAt).toLocaleString()}</span>
                                        </div>
                                        <button onclick="eventApp._deleteBatch('${b.batchId}')"
                                            class="text-red-400 hover:text-red-600 text-xs border border-red-200 px-2 py-0.5 rounded hover:bg-red-50">삭제</button>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>`).join('')}
                </div>`).join('');

        // 스테이징 파일 목록 (개별 날짜/권역 표시)
        const mkStagedList = (platform) =>
            (this._staged[platform] || []).map((f, i) => `
                <div class="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-gray-200 text-xs mb-1">
                    <div class="flex-1 min-w-0">
                        <div class="truncate text-gray-700 font-bold" title="${f.name}">📄 ${f.name}</div>
                        <div class="text-gray-400 mt-0.5 flex gap-2">
                            <span class="bg-gray-100 px-1 rounded">${f.date}</span>
                            <span class="bg-purple-50 text-purple-600 px-1 rounded">${f.region || '권역 미지정'}</span>
                        </div>
                    </div>
                    <button onclick="eventApp._removeStaged('${platform}',${i})"
                        class="ml-2 text-gray-400 hover:text-red-500 font-bold flex-shrink-0 p-1">✕</button>
                </div>`).join('') || '<p class="text-xs text-gray-400 text-center py-3">파일을 여기에 끌어다 놓거나 클릭하여 선택</p>';

        const totalStaged = (this._staged.baemin||[]).length + (this._staged.coupang||[]).length;

        return `
            <!-- 날짜 + 권역 공통 설정 -->
            <div class="glass-panel rounded-xl border border-purple-100 p-5 mb-6">
                <h3 class="font-bold text-gray-800 mb-3 flex items-center">
                    <i data-lucide="settings-2" class="w-4 h-4 mr-2 text-purple-600"></i> 업로드 공통 설정
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">📅 날짜</label>
                        <input type="date" id="ev-up-date" value="${new Date().toISOString().slice(0,10)}"
                            class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">📍 권역</label>
                        <input type="text" id="ev-up-region" placeholder="예: 김해북부"
                            class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                    </div>
                </div>
                <p class="text-xs text-gray-400 mt-2">※ 날짜와 권역을 먼저 입력 후 파일을 올려주세요.</p>
            </div>

            <!-- 드롭존 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                <!-- 배민 드롭존 -->
                <div class="glass-panel rounded-xl border border-teal-200 p-5 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                    <h3 class="font-bold text-gray-800 mb-3 flex items-center">
                        <i data-lucide="bike" class="w-5 h-5 mr-2 text-teal-600"></i>
                        배민 정산서
                        <span class="ml-auto text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                            ${(this._staged.baemin||[]).length}개 대기중
                        </span>
                    </h3>

                    <!-- 드롭 영역 -->
                    <div id="drop-baemin"
                        ondragover="eventApp._onDragOver(event,'baemin')"
                        ondragleave="eventApp._onDragLeave(event,'baemin')"
                        ondrop="eventApp._onDrop(event,'baemin')"
                        onclick="document.getElementById('ev-file-b').click()"
                        class="border-2 border-dashed border-teal-300 rounded-xl p-5 mb-3 text-center cursor-pointer hover:bg-teal-50 transition-all min-h-[80px] flex items-center justify-center">
                        <div>
                            <i data-lucide="upload-cloud" class="w-8 h-8 text-teal-400 mx-auto mb-1"></i>
                            <p class="text-xs text-teal-600 font-bold">파일을 끌어다 놓거나 클릭하여 선택</p>
                            <p class="text-xs text-gray-400">여러 파일 한번에 가능</p>
                        </div>
                    </div>
                    <input type="file" id="ev-file-b" accept=".xlsx,.xls" multiple class="hidden"
                        onchange="eventApp._stageFiles('baemin', this.files)">

                    <!-- 스테이징 목록 -->
                    <div class="space-y-1 max-h-40 overflow-y-auto mb-3">${mkStagedList('baemin')}</div>
                </div>

                <!-- 쿠팡 드롭존 -->
                <div class="glass-panel rounded-xl border border-red-200 p-5 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                    <h3 class="font-bold text-gray-800 mb-3 flex items-center">
                        <i data-lucide="truck" class="w-5 h-5 mr-2 text-red-600"></i>
                        쿠팡 정산서
                        <span class="ml-auto text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            ${(this._staged.coupang||[]).length}개 대기중
                        </span>
                    </h3>

                    <div id="drop-coupang"
                        ondragover="eventApp._onDragOver(event,'coupang')"
                        ondragleave="eventApp._onDragLeave(event,'coupang')"
                        ondrop="eventApp._onDrop(event,'coupang')"
                        onclick="document.getElementById('ev-file-c').click()"
                        class="border-2 border-dashed border-red-300 rounded-xl p-5 mb-3 text-center cursor-pointer hover:bg-red-50 transition-all min-h-[80px] flex items-center justify-center">
                        <div>
                            <i data-lucide="upload-cloud" class="w-8 h-8 text-red-400 mx-auto mb-1"></i>
                            <p class="text-xs text-red-600 font-bold">파일을 끌어다 놓거나 클릭하여 선택</p>
                            <p class="text-xs text-gray-400">여러 파일 한번에 가능</p>
                        </div>
                    </div>
                    <input type="file" id="ev-file-c" accept=".xlsx,.xls" multiple class="hidden"
                        onchange="eventApp._stageFiles('coupang', this.files)">

                    <div class="space-y-1 max-h-40 overflow-y-auto mb-3">${mkStagedList('coupang')}</div>
                </div>
            </div>

            <!-- 한번에 업로드 버튼 -->
            <div class="glass-panel rounded-xl border border-gray-100 p-5 mb-6 flex items-center justify-between">
                <div>
                    <p class="font-bold text-gray-800">총 <span class="text-purple-600">${totalStaged}개</span> 파일 대기중</p>
                    <p class="text-xs text-gray-400 mt-0.5">배민 ${(this._staged.baemin||[]).length}개 · 쿠팡 ${(this._staged.coupang||[]).length}개</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="eventApp._clearStaged()"
                        class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold transition-all">
                        초기화
                    </button>
                    <button onclick="eventApp._parseAndUploadAll()"
                        ${totalStaged === 0 ? 'disabled' : ''}
                        class="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow disabled:opacity-40">
                        🚀 한번에 업로드
                    </button>
                </div>
            </div>

            <!-- 업로드 내역 (날짜·권역별 그룹) -->
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <h3 class="font-bold text-gray-800 mb-4">
                    업로드 내역 <span class="text-gray-400 font-normal text-sm">(${batches.length}건)</span>
                </h3>
                ${historyHtml}
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
                                <label class="text-xs font-bold text-gray-500 mb-1 block">대상 기간</label>
                                <div class="flex items-center gap-1">
                                    <input type="date" id="ev-start" value="${new Date().toISOString().slice(0,10)}"
                                        class="w-full border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                                    <span class="text-gray-400">~</span>
                                    <input type="date" id="ev-end" value="${new Date().toISOString().slice(0,10)}"
                                        class="w-full border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                                </div>
                            </div>
                            <div>
                                <label class="text-xs font-bold text-gray-500 mb-1 block">권역</label>
                                <select id="ev-region" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none">
                                    ${regionOpts}
                                </select>
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
                    <div class="flex items-center gap-1 border rounded-lg px-2 bg-white focus-within:ring-2 focus-within:ring-yellow-400">
                        <input type="date" id="rank-start" value="${new Date().toISOString().slice(0,10)}" class="py-2 text-sm focus:outline-none bg-transparent">
                        <span class="text-gray-400">~</span>
                        <input type="date" id="rank-end" value="${new Date().toISOString().slice(0,10)}" class="py-2 text-sm focus:outline-none bg-transparent">
                    </div>
                    <select id="rank-region" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none">
                        ${regions.map(r => `<option value="${r}">${r}</option>`).join('')}
                    </select>
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
        const start  = document.getElementById('ev-start')?.value || '';
        const end    = document.getElementById('ev-end')?.value || '';
        const region = document.getElementById('ev-region')?.value || '전체';
        
        if (!start || !end) { alert('대상 기간을 선택하세요.'); return; }

        // 이벤트 내역(히스토리)에 남은 당첨자 추출 (룰렛 배제용)
        const pastEvents = eventDb.getEvents();
        const prevWinnerIds = [];
        pastEvents.forEach(ev => {
            if (ev.winners) {
                ev.winners.forEach(w => prevWinnerIds.push(w.riderId || w.name));
            }
        });

        this._winners = [];
        this._spinAngle = 0;
        this._pool = eventDb.getRouletteCandidates(start, end, region, 0, prevWinnerIds);

        if (this._pool.length === 0) {
            alert('해당 조건의 후보가 없습니다.\n정산서가 업로드되어 있는지 확인하세요.');
            return;
        }

        this.render(document.getElementById('app-content'));
    },

    _loadRanking() {
        const start  = document.getElementById('rank-start')?.value || '';
        const end    = document.getElementById('rank-end')?.value || '';
        const region = document.getElementById('rank-region')?.value || '전체';

        if (!start || !end) { alert('기간을 선택하세요.'); return; }

        const ranking = eventDb.getRanking(start, end, region, 0, []);
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
            </tr>`).join('');

        resultDiv.innerHTML = `
            <table class="w-full text-left text-sm">
                <thead class="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                        <th class="py-3 px-4">순위</th>
                        <th class="py-3 px-4">라이더</th>
                        <th class="py-3 px-4 text-center">수행 콜 수</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    },

    // ── 드래그&드롭 핸들러 ───────────────────────────────────
    _onDragOver(e, platform) {
        e.preventDefault();
        const zone = document.getElementById(`drop-${platform}`);
        if (zone) zone.classList.add(platform === 'baemin' ? 'bg-teal-50' : 'bg-red-50', 'border-opacity-100');
    },
    _onDragLeave(e, platform) {
        const zone = document.getElementById(`drop-${platform}`);
        if (zone) zone.classList.remove('bg-teal-50', 'bg-red-50');
    },
    _onDrop(e, platform) {
        e.preventDefault();
        const zone = document.getElementById(`drop-${platform}`);
        if (zone) zone.classList.remove('bg-teal-50', 'bg-red-50');
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.match(/\.(xlsx|xls)$/i));
        if (files.length === 0) { alert('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'); return; }
        this._stageFiles(platform, files);
    },

    _stageFiles(platform, fileList) {
        const files = Array.from(fileList);
        if (!this._staged[platform]) this._staged[platform] = [];
        
        const defaultDate = document.getElementById('ev-up-date')?.value || new Date().toISOString().slice(0,10);
        const defaultRegion = document.getElementById('ev-up-region')?.value || '';

        // 중복 파일명 제외
        const existing = new Set(this._staged[platform].map(f => f.name));
        files.filter(f => !existing.has(f.name)).forEach(file => {
            const date = ExcelParser.detectDateFromFilename(file.name) || defaultDate;
            const region = ExcelParser.detectRegionFromFilename(file.name) || defaultRegion;
            
            this._staged[platform].push({
                file,
                name: file.name,
                date,
                region
            });
        });
        this._refreshUploadUI();
    },

    _removeStaged(platform, idx) {
        if (this._staged[platform]) this._staged[platform].splice(idx, 1);
        this._refreshUploadUI();
    },

    _clearStaged() {
        this._staged = { baemin: [], coupang: [] };
        this._refreshUploadUI();
    },

    _refreshUploadUI() {
        // 탭 전체 재렌더 없이 업로드 탭만 갱신
        const body = document.getElementById('event-body');
        if (body && this._tab === 'upload') {
            body.innerHTML = this._renderUpload();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    },

    // 이벤트 전용 파서 (주정산/일정산 통합 수행 건수 추출)
    async _parseEventExcel(file, platform) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    let sheetName = wb.SheetNames[0];
                    if (platform === 'coupang') {
                        const coupangSheet = wb.SheetNames.find(n => n.includes('오더별') || n.includes('상세내역') || n.includes('Order'));
                        if (coupangSheet) sheetName = coupangSheet;
                    } else if (platform === 'baemin') {
                        const baeminSheet = wb.SheetNames.find(n => n.includes('라이더정산') || n.includes('상세'));
                        if (baeminSheet) sheetName = baeminSheet;
                    }

                    const ws = wb.Sheets[sheetName];
                    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                    let headerRowIdx = -1;
                    const _norm = (s) => (s||'').toString().replace(/\s/g,'').toLowerCase();
                    for(let i=0; i<Math.min(50, rawRows.length); i++) {
                        const row = rawRows[i].map(_norm);
                        if(row.some(c => c.includes('라이더명') || c.includes('이름') || c.includes('파트너명') || c.includes('성함'))) {
                            headerRowIdx = i;
                            break;
                        }
                    }

                    if(headerRowIdx === -1) return reject(new Error('라이더명/이름 컬럼을 찾을 수 없습니다.'));

                    const headers = rawRows[headerRowIdx].map(_norm);
                    const nameIdx = headers.findIndex(c => c.includes('라이더명') || c.includes('이름') || c.includes('파트너명') || c.includes('성함'));
                    const countIdx = headers.findIndex(c => c.includes('배달건수') || c.includes('수행건수') || c.includes('완료건수'));
                    const acceptIdx = headers.findIndex(c => c.includes('수락률'));
                    const statusIdx = headers.findIndex(c => c.includes('상태'));
                    let idIdx = headers.findIndex(c => c.includes('userid') || c.includes('이메일') || c.includes('로그인id'));
                    if (idIdx === -1) {
                        idIdx = headers.findIndex(c => {
                            if (c.includes('지점') || c.includes('권역') || c.includes('협력사') || c.includes('대행사')) return false;
                            return c.includes('라이더id') || c === '아이디' || c.includes('라이더계정') || c.includes('배민아이디');
                        });
                    }

                    const isDaily = countIdx === -1; 
                    const tempMap = {};

                    const dataRows = rawRows.slice(headerRowIdx + 1);
                    dataRows.forEach(row => {
                        let rawName = (row[nameIdx] || '').toString().trim();
                        if (!rawName) return;

                        let filePhone = '';
                        const m = rawName.match(/^(.*?)([0-9]{4})$/);
                        let name = rawName;
                        if (m) {
                            name = m[1].trim();
                            filePhone = m[2];
                        }

                        let fileId = '';
                        if (idIdx !== -1) {
                            fileId = (row[idIdx] || '').toString().trim();
                        }

                        if (isDaily) {
                            if (statusIdx !== -1) {
                                const status = (row[statusIdx] || '').toString();
                                if (['취소', '반려', 'cancel', 'rejected'].some(s => status.includes(s))) return;
                            }
                            if (!tempMap[name]) tempMap[name] = { count: 0, acceptRate: 0, filePhone, fileId };
                            tempMap[name].count += 1;
                        } else {
                            const count = parseFloat((row[countIdx] || 0).toString().replace(/,/g,''));
                            const accept = parseFloat((row[acceptIdx] || '0').toString().replace(/%/g,''));
                            if (count > 0) {
                                if (!tempMap[name]) tempMap[name] = { count: 0, acceptRate: 0, filePhone, fileId };
                                tempMap[name].count += count;
                                tempMap[name].acceptRate = accept || 0;
                            }
                        }
                    });

                    const activeMembers = (typeof db !== 'undefined' ? db.getMembers() : []) || [];
                    const records = [];
                    for (const [name, data] of Object.entries(tempMap)) {
                        const member = activeMembers.find(m => {
                            if (m.status !== 'approved') return false;
                            const dbNames = (m.name||'').split(',').map(n=>n.trim());
                            return dbNames.includes(name);
                        });

                        // ── Display Name 포맷 결정 ──
                        let displayName = name;
                        if (platform === 'baemin') {
                            // 배민: 파일에서 뽑은 ID 우선. 정 없다면 DB의 ID, 그것도 없으면 이름.
                            displayName = data.fileId || ((member && member.baeminId) ? member.baeminId.split(',')[0].trim() : name);
                        } else if (platform === 'coupang') {
                            let masked = name;
                            if (masked.length >= 3) {
                                masked = masked.slice(0,1) + '*' + masked.slice(2);
                            } else if (masked.length === 2) {
                                masked = masked.slice(0,1) + '*';
                            }
                            const phone = (member && member.coupangPhone) ? member.coupangPhone.split(',')[0].trim() : data.filePhone;
                            displayName = `${masked}${phone}`;
                        }

                        // DB에 없는 라이더라면 랜덤 ID가 아니라 고유 식별자(배민ID 또는 이름)를 사용해 여러 파일의 동일인을 묶음
                        let resolvedRiderId = null;
                        if (member) {
                            resolvedRiderId = member.id;
                        } else if (platform === 'baemin' && data.fileId) {
                            resolvedRiderId = data.fileId;
                        }

                        records.push({
                            riderId: resolvedRiderId, // null이면 event_db.js에서 name으로 묶음
                            name: name,
                            displayName: displayName,
                            amount: data.count, // eventDb는 콜 수를 amount 필드에 저장
                            acceptRate: data.acceptRate || 0
                        });
                    }
                    resolve(records);
                } catch(e) {
                    reject(e);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    async _parseAndUploadAll() {
        const total = (this._staged.baemin||[]).length + (this._staged.coupang||[]).length;
        if (total === 0) { alert('업로드할 파일이 없습니다.'); return; }

        let added = 0;
        const errors = [];
        const uploadedInfo = [];

        for (const platform of ['baemin', 'coupang']) {
            for (const item of (this._staged[platform] || [])) {
                if (!item.region) {
                    errors.push(`${item.name}: 권역을 알 수 없습니다. (공통 설정에 권역을 입력하거나 파일명에 포함시키세요)`);
                    continue;
                }
                try {
                    const records = await this._parseEventExcel(item.file, platform);
                    if (records && records.length > 0) {
                        const batch = eventDb.addEventSettlementBatch(platform, item.date, item.region, records, true);
                        eventDb.updateBatchDate(batch.batchId, item.date, true);
                        added += records.length;
                        uploadedInfo.push(`${item.date} [${item.region}] ${records.length}명 (${records.reduce((a,b)=>a+b.amount,0)}콜)`);
                    } else {
                        errors.push(`${item.name}: 파싱된 유효한 데이터(콜 수행기록)가 없습니다.`);
                    }
                } catch (err) {
                    errors.push(`${item.name}: ${err.message}`);
                }
            }
        }

        if (added > 0) {
            eventDb.pushEventSettlements(); // 한 번에 DB 전송
            alert(`✅ 업로드 완료!\n총 ${added}명 데이터 저장\n\n${uploadedInfo.join('\\n')}${errors.length ? '\\n\\n⚠️ 오류:\\n' + errors.join('\\n') : ''}`);
            this._staged = { baemin: [], coupang: [] };
            this.render(document.getElementById('app-content'));
        } else {
            alert('유효한 데이터가 저장되지 않았습니다.\\n' + errors.join('\\n'));
        }
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
                    eventDb.addEventSettlementBatch(platform, weekLabel, region, records, true);
                    totalAdded += records.length;
                }
            } catch (err) {
                console.error('[eventApp] parse error:', err);
                alert(`파일 파싱 오류: ${file.name}\n${err.message}`);
            }
        }

        if (totalAdded > 0) {
            eventDb.pushEventSettlements(); // 한 번에 DB 전송
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

        const start  = document.getElementById('ev-start')?.value || '';
        const end    = document.getElementById('ev-end')?.value || '';
        const region = document.getElementById('ev-region')?.value || '전체';
        const amount = parseInt(document.getElementById('ev-amount')?.value || '0');
        const label  = document.getElementById('ev-label')?.value || '이벤트 당첨금';

        const event = eventDb.createEvent({
            weekLabel: `${start} ~ ${end}`, region, rewardAmount: amount, rewardLabel: label,
            title: `${start} ~ ${end} ${region} 룰렛 추첨`
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
