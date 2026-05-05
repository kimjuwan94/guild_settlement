/**
 * 소득신고 정산 관리 - UI 렌더링 모듈
 * 기존 app.js와 완전 독립. incomeApp.render(container) 로 호출
 */
const incomeApp = {
    _tab: 'summary', // 'summary' | 'riders' | 'upload' | 'batches'
    _filterYear: '',   // 선택된 연도 ('' = 전체)
    _filterMonth: '',  // 선택된 월 ('' = 전체)
    // 업로드 행 상태 (플랫폼별 독립)
    _baeminRows: [{ id: 1 }],
    _coupangRows: [{ id: 1 }],
    _nextRowId: 2,

    render(container) {
        const tabs = [
            { id: 'summary', label: '📊 수입 집계' },
            { id: 'riders',  label: '👤 라이더 관리' },
            { id: 'upload',  label: '📤 정산서 업로드' },
            { id: 'batches', label: '📋 업로드 내역' },
        ];
        const tabHtml = tabs.map(t => `
            <button onclick="incomeApp._tab='${t.id}'; incomeApp.render(document.getElementById('app-content'))"
                class="px-4 py-2 text-sm font-bold rounded-lg transition-all ${this._tab === t.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}">
                ${t.label}
            </button>`).join('');

        let bodyHtml = '';
        if (this._tab === 'summary') bodyHtml = this._renderSummary();
        else if (this._tab === 'riders') bodyHtml = this._renderRiders();
        else if (this._tab === 'upload') bodyHtml = this._renderUpload();
        else if (this._tab === 'batches') bodyHtml = this._renderBatches();

        container.innerHTML = `
            <div class="max-w-6xl mx-auto">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-black text-gray-900">소득신고 정산 관리</h2>
                        <p class="text-sm text-gray-500 mt-1">라이더별 배민·쿠팡 수입을 집계하여 세무 신고용 자료를 생성합니다.</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mb-6">${tabHtml}</div>
                <div id="income-body">${bodyHtml}</div>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // ── 탭: 수입 집계 ─────────────────────────────────────
    _renderSummary() {
        const allWeeks = incomeDb.getUniqueWeekLabels(); // ['2025-10-1','2025-10-2', ...]

        // 연도/월 목록 추출 (주차 형식: 2025-10-1 → year=2025, month=10)
        const yearSet = new Set(), monthSet = new Set();
        allWeeks.forEach(w => {
            const parts = w.split('-');
            if (parts[0]) yearSet.add(parts[0]);
            if (parts[1]) monthSet.add(parts[1].padStart(2,'0'));
        });
        const years  = [...yearSet].sort().reverse();
        const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];

        const yearOptions  = `<option value="">전체 연도</option>` +
            years.map(y => `<option value="${y}" ${this._filterYear === y ? 'selected' : ''}>${y}년</option>`).join('');
        const monthOptions = `<option value="">전체 월</option>` +
            months.map(m => `<option value="${m}" ${this._filterMonth === m ? 'selected' : ''}>${parseInt(m)}월</option>`).join('');

        // 필터에 맞는 주차 목록 계산
        const filteredWeeks = allWeeks.filter(w => {
            const parts = w.split('-');
            const y = parts[0] || '';
            const m = (parts[1] || '').padStart(2,'0');
            if (this._filterYear  && y !== this._filterYear)  return false;
            if (this._filterMonth && m !== this._filterMonth) return false;
            return true;
        });

        const isFiltered = this._filterYear || this._filterMonth;
        const summary = isFiltered
            ? incomeDb.getSummaryByRiderFiltered(filteredWeeks)
            : incomeDb.getSummaryByRider();

        const totalBaemin  = summary.reduce((s, r) => s + r.baemin,  0);
        const totalCoupang = summary.reduce((s, r) => s + r.coupang, 0);
        const totalAll     = totalBaemin + totalCoupang;

        const periodLabel = isFiltered
            ? `${this._filterYear || '전체'} ${this._filterMonth ? parseInt(this._filterMonth) + '월' : '전체'} 기준`
            : '전체 기간';

        const rows = summary.map(r => `
            <tr class="border-b border-gray-100 hover:bg-indigo-50">
                <td class="py-3 px-4 font-semibold text-gray-800">${r.name}</td>
                <td class="py-3 px-4 text-gray-500 text-xs">${r.phone}</td>
                <td class="py-3 px-4 text-teal-700 font-mono">${r.baemin.toLocaleString()}원</td>
                <td class="py-3 px-4 text-red-600 font-mono">${r.coupang.toLocaleString()}원</td>
                <td class="py-3 px-4 font-black text-indigo-700 font-mono">${r.total.toLocaleString()}원</td>
            </tr>`).join('') || `<tr><td colspan="5" class="text-center py-8 text-gray-400">해당 기간에 정산 데이터가 없습니다.</td></tr>`;

        return `
            <!-- 기간 필터 -->
            <div class="glass-panel rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 mb-5">
                <div class="flex flex-wrap items-center gap-3">
                    <span class="text-sm font-bold text-indigo-700 whitespace-nowrap">📅 기간 선택</span>
                    <select id="filter-year" class="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white">
                        ${yearOptions}
                    </select>
                    <select id="filter-month" class="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white">
                        ${monthOptions}
                    </select>
                    <button onclick="incomeApp._applyFilter()" class="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                        <i data-lucide="search" class="w-4 h-4"></i> 검색
                    </button>
                    ${isFiltered ? `<button onclick="incomeApp._clearFilter()" class="px-4 py-2 bg-white text-gray-500 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">초기화</button>` : ''}
                    <span class="text-xs text-indigo-500 ml-auto">${periodLabel} · 해당 주차 ${filteredWeeks.length}개</span>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="bg-teal-50 border border-teal-200 rounded-xl p-5">
                    <p class="text-xs font-bold text-teal-600 mb-1">배민 총 수입</p>
                    <p class="text-2xl font-black text-teal-800">${totalBaemin.toLocaleString()}원</p>
                </div>
                <div class="bg-red-50 border border-red-200 rounded-xl p-5">
                    <p class="text-xs font-bold text-red-600 mb-1">쿠팡 총 수입</p>
                    <p class="text-2xl font-black text-red-800">${totalCoupang.toLocaleString()}원</p>
                </div>
                <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                    <p class="text-xs font-bold text-indigo-600 mb-1">전체 합계</p>
                    <p class="text-2xl font-black text-indigo-800">${totalAll.toLocaleString()}원</p>
                </div>
            </div>
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-gray-800">라이더별 수입 집계 <span class="text-indigo-500">(${summary.length}명 / ${periodLabel})</span></h3>
                    <button onclick="incomeApp._downloadSummary()" class="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-all">
                        <i data-lucide="download" class="w-4 h-4 mr-2"></i> 엑셀 다운로드
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th class="py-3 px-4">이름</th>
                                <th class="py-3 px-4">전화번호</th>
                                <th class="py-3 px-4 text-teal-700">배민 수입</th>
                                <th class="py-3 px-4 text-red-600">쿠팡 수입</th>
                                <th class="py-3 px-4 text-indigo-700">합계</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot class="bg-gray-50 font-black">
                            <tr>
                                <td colspan="2" class="py-3 px-4 text-gray-700">합계</td>
                                <td class="py-3 px-4 text-teal-700">${totalBaemin.toLocaleString()}원</td>
                                <td class="py-3 px-4 text-red-600">${totalCoupang.toLocaleString()}원</td>
                                <td class="py-3 px-4 text-indigo-700">${totalAll.toLocaleString()}원</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>`;
    },

    _applyFilter() {
        const y = document.getElementById('filter-year')?.value  || '';
        const m = document.getElementById('filter-month')?.value || '';
        this._filterYear  = y;
        this._filterMonth = m;
        // 탭 전환 없이 body 영역만 재렌더
        const body = document.getElementById('income-body');
        if (body) { body.innerHTML = this._renderSummary(); lucide.createIcons(); }
    },

    _clearFilter() {
        this._filterYear  = '';
        this._filterMonth = '';
        const body = document.getElementById('income-body');
        if (body) { body.innerHTML = this._renderSummary(); lucide.createIcons(); }
    },

    // ── 탭: 라이더 관리 ──────────────────────────────────
    _renderRiders() {
        const riders = incomeDb.getRiders();
        const rows = riders.map(r => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 px-4 font-semibold">${r.name}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${r.phone}</td>
                <td class="py-3 px-4 text-xs text-gray-500 font-mono">${r.residentNo || '-'}</td>
                <td class="py-3 px-4 text-xs font-mono text-teal-700">${r.baeminId || '-'}</td>
                <td class="py-3 px-4 text-xs font-mono text-red-600">${r.coupangLast4 || '-'}</td>
                <td class="py-3 px-4 text-right">
                    <button onclick="incomeApp._deleteRider('${r.id}','${r.name}')"
                        class="text-red-400 hover:text-red-600 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50">삭제</button>
                </td>
            </tr>`).join('') || `<tr><td colspan="6" class="text-center py-8 text-gray-400">등록된 라이더가 없습니다.</td></tr>`;

        return `
            <div class="glass-panel rounded-xl border border-gray-100 p-6 mb-6">
                <h3 class="font-bold text-gray-800 mb-4">신규 라이더 등록</h3>
                <form onsubmit="incomeApp._addRider(event)" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <input id="ir-name" required placeholder="이름 *" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <input id="ir-phone" required placeholder="전화번호 * (010-0000-0000)" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <input id="ir-resident" placeholder="주민번호 (000000-0000000)" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <input id="ir-baemin" placeholder="배민 ID" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <input id="ir-coupang" placeholder="쿠팡 뒷번호 4자리" class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <button type="submit" class="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-indigo-700 transition-all">+ 등록</button>
                </form>
            </div>

            <div class="glass-panel rounded-xl border border-gray-100 p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-gray-800">엑셀 일괄 등록</h3>
                    <button onclick="IncomeExcelParser.downloadRiderTemplate()" class="flex items-center text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                        <i data-lucide="download" class="w-4 h-4 mr-1"></i> 등록 양식 다운로드
                    </button>
                </div>
                <div class="flex gap-3">
                    <input type="file" id="bulk-rider-file" accept=".xlsx,.xls" class="flex-1 text-sm border rounded-lg px-3 py-2">
                    <button onclick="incomeApp._bulkUpload()" class="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700">일괄 등록</button>
                </div>
                <p class="text-xs text-gray-400 mt-2">※ 양식 다운로드 후 작성하여 업로드하세요. 이름+전화번호 중복 시 자동 스킵됩니다.</p>
            </div>

            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <h3 class="font-bold text-gray-800 mb-4">등록 라이더 목록 (${riders.length}명)</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th class="py-3 px-4">이름</th><th class="py-3 px-4">전화번호</th>
                                <th class="py-3 px-4">주민번호</th><th class="py-3 px-4">배민ID</th>
                                <th class="py-3 px-4">쿠팡뒷번호</th><th class="py-3 px-4 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    },

    // ── 탭: 정산서 업로드 ─────────────────────────────────
    _renderUpload() {
        const makeRows = (rows, platform) => rows.map(r => `
            <div id="upload-row-${platform}-${r.id}" class="flex gap-2 items-center mb-2">
                <input type="text" id="week-${platform}-${r.id}"
                    placeholder="주차 (2026-04-4)"
                    class="w-28 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-${platform === 'baemin' ? 'teal' : 'red'}-400 focus:outline-none flex-shrink-0">
                <input type="text" id="region-${platform}-${r.id}"
                    placeholder="권역 (예:강남)"
                    class="w-24 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-gray-300 focus:outline-none flex-shrink-0">
                <input type="file" id="file-${platform}-${r.id}" accept=".xlsx,.xls" multiple
                    onchange="incomeApp._autoDetectWeek('${platform}', ${r.id}, this)"
                    class="flex-1 text-sm border rounded-lg px-2 py-2">
                <button onclick="incomeApp._removeUploadRow('${platform}',${r.id})"
                    class="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg hover:border-red-300 transition-all">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>`).join('');

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                <!-- 배민 -->
                <div class="glass-panel rounded-xl border border-teal-200 p-6 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                    <h3 class="font-bold text-gray-800 mb-1 flex items-center">
                        <i data-lucide="bike" class="w-5 h-5 mr-2 text-teal-600"></i> 배민 주정산서 업로드
                    </h3>
                    <p class="text-xs text-gray-500 mb-3">시트: "을지_협력사_소속_라이더정산_확인용"<br>컬럼: 라이더명, user ID, 라이더별정산금액</p>

                    <!-- 배민 날짜→주차 변환기 -->
                    <div class="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
                        <p class="text-xs font-bold text-teal-700 mb-2">🗓️ 날짜범위 → 주차 자동 변환</p>
                        <div class="flex gap-2">
                            <input type="text" id="baemin-date-range"
                                placeholder="20260422~20260428"
                                class="flex-1 border border-teal-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none bg-white">
                            <button onclick="incomeApp._convertBaeminDate()"
                                class="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-all whitespace-nowrap">
                                변환
                            </button>
                        </div>
                        <p id="baemin-convert-result" class="text-xs text-teal-700 mt-1.5 hidden"></p>
                        <p class="text-xs text-teal-500 mt-1">※ 주차 형식: <span class="font-mono font-bold">2026-04-4</span> (년-월-주차)</p>
                    </div>

                    <div id="baemin-upload-rows">
                        ${makeRows(this._baeminRows, 'baemin')}
                    </div>

                    <button onclick="incomeApp._addUploadRow('baemin')"
                        class="w-full mt-2 mb-4 py-2 border-2 border-dashed border-teal-300 text-teal-600 text-sm font-bold rounded-lg hover:bg-teal-50 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="plus" class="w-4 h-4"></i> 주차 추가
                    </button>

                    <button onclick="incomeApp._uploadAllRows('baemin')"
                        class="w-full bg-teal-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-teal-700 transition-all">
                        전체 파싱 및 반영
                    </button>
                </div>

                <!-- 쿠팡 -->
                <div class="glass-panel rounded-xl border border-red-200 p-6 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                    <h3 class="font-bold text-gray-800 mb-1 flex items-center">
                        <i data-lucide="truck" class="w-5 h-5 mr-2 text-red-600"></i> 쿠팡 주정산서 업로드
                    </h3>
                    <p class="text-xs text-gray-500 mb-3">시트: "종합"<br>컬럼: 성함 (홍길동1234), 라이더별실지급액</p>

                    <!-- 쿠팡 형식 안내 -->
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p class="text-xs font-bold text-red-600 mb-1">📌 주차 입력 방법</p>
                        <p class="text-xs text-red-700">쿠팡 정산서 파일명/제목의 <span class="font-bold">년/월/주차</span>를 그대로 입력하세요.</p>
                        <div class="mt-2 flex flex-col gap-1">
                            <p class="text-xs font-mono bg-white border border-red-200 rounded px-2 py-1">
                                2026년 4월 4주차 → <span class="font-bold text-red-700">2026-04-4</span>
                            </p>
                            <p class="text-xs font-mono bg-white border border-red-200 rounded px-2 py-1">
                                2026년 5월 1주차 → <span class="font-bold text-red-700">2026-05-1</span>
                            </p>
                        </div>
                    </div>

                    <div id="coupang-upload-rows">
                        ${makeRows(this._coupangRows, 'coupang')}
                    </div>

                    <button onclick="incomeApp._addUploadRow('coupang')"
                        class="w-full mt-2 mb-4 py-2 border-2 border-dashed border-red-300 text-red-500 text-sm font-bold rounded-lg hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="plus" class="w-4 h-4"></i> 주차 추가
                    </button>

                    <button onclick="incomeApp._uploadAllRows('coupang')"
                        class="w-full bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 transition-all">
                        전체 파싱 및 반영
                    </button>
                </div>

            </div>
            <div id="income-upload-result"></div>`;
    },

    // ── 업로드 행 관리 ────────────────────────────────────
    _addUploadRow(platform) {
        const id = this._nextRowId++;
        if (platform === 'baemin') this._baeminRows.push({ id });
        else this._coupangRows.push({ id });

        // 행만 DOM에 직접 추가 (전체 재렌더 없이)
        const container = document.getElementById(`${platform}-upload-rows`);
        if (!container) return;
        const div = document.createElement('div');
        div.id = `upload-row-${platform}-${id}`;
        div.className = 'flex gap-2 items-center mb-2';
        div.innerHTML = `
            <input type="text" id="week-${platform}-${id}"
                placeholder="주차 (2026-04-4)"
                class="w-28 border rounded-lg px-2 py-2 text-sm flex-shrink-0">
            <input type="text" id="region-${platform}-${id}"
                placeholder="권역 (예:강남)"
                class="w-24 border rounded-lg px-2 py-2 text-sm flex-shrink-0">
            <input type="file" id="file-${platform}-${id}" accept=".xlsx,.xls" multiple
                onchange="incomeApp._autoDetectWeek('${platform}', ${id}, this)"
                class="flex-1 text-sm border rounded-lg px-2 py-2">
            <button onclick="incomeApp._removeUploadRow('${platform}',${id})"
                class="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg hover:border-red-300 transition-all">
                <i data-lucide='x' class='w-4 h-4'></i>
            </button>`;
        container.appendChild(div);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // ── 파일명 자동 주차·권역 감지 ────────────────────────────
    _autoDetectWeek(platform, rowId, fileInput) {
        const weekEl   = document.getElementById(`week-${platform}-${rowId}`);
        const regionEl = document.getElementById(`region-${platform}-${rowId}`);
        const file = fileInput.files[0];
        if (!file) return;

        // 주차 자동 입력 (빈 칸일 때만)
        if (weekEl && !weekEl.value.trim()) {
            const label = this._parseWeekFromFilename(file.name, platform);
            if (label) {
                weekEl.value = label;
                weekEl.classList.add('ring-2', platform === 'baemin' ? 'ring-teal-400' : 'ring-red-400');
                setTimeout(() => weekEl.classList.remove('ring-2', 'ring-teal-400', 'ring-red-400'), 2000);
            }
        }
        // 권역 자동 입력 (빈 칸일 때만)
        if (regionEl && !regionEl.value.trim()) {
            const region = this._parseRegionFromFilename(file.name);
            if (region) {
                regionEl.value = region;
                regionEl.classList.add('ring-2', 'ring-indigo-300');
                setTimeout(() => regionEl.classList.remove('ring-2', 'ring-indigo-300'), 2000);
            }
        }
    },

    _parseRegionFromFilename(filename) {
        const KNOWN = ['강남','강북','강서','강동','강릉','김해','부산','경남','경북','경기',
                       '서울','인천','대구','광주','대전','울산','수원','성남','고양','창원',
                       '구미','포항','진주','마산','통영','거제','양산','밀양','제주',
                       '종로','마포','영등포','동작','관악','서초','송파'];
        const name = filename.replace(/\.xlsx?$/i, '');
        for (const region of KNOWN) {
            if (name.includes(region)) return region;
        }
        const stopWords = ['주식회사','플루체','정산서','확인용','협력사','소속','라이더','배달','쿠팡','배민','스페이스','파트너','파트스'];
        const tokens = name.split(/[_\s\-~]/)
            .map(t => t.replace(/[^가-힣]/g, '').trim())
            .filter(t => t.length >= 2 && t.length <= 5 && !stopWords.includes(t));
        return tokens[tokens.length - 1] || '';
    },

    /**
     * 파일명에서 주차 레이블(YYYY-MM-W) 추출
     * 배민:  20260422~20260428_...xlsx  → 2026-04-4
     * 쿠팡:  2026년4월4주차_...xlsx      → 2026-04-4
     *        플루체스페이스_경남_2026_04_4.xlsx 등 다양한 패턴 대응
     */
    _parseWeekFromFilename(filename, platform) {
        // ── 쿠팡: 한글 주차 패턴 ────────────────────────────
        // "2026년4월4주차" / "2026년 4월 4주차"
        let m = filename.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*주/);
        if (m) {
            const [, y, mo, w] = m;
            return `${y}-${mo.padStart(2,'0')}-${w}`;
        }

        // 쿠팡: 숫자만 패턴 "2026_04_4" / "2026/04/4"
        m = filename.match(/(\d{4})[_\/\-](\d{1,2})[_\/\-](\d{1})(?:[^\d]|$)/);
        if (m) {
            const [, y, mo, w] = m;
            // w가 1~5 범위일 때만 주차로 해석
            if (parseInt(w) >= 1 && parseInt(w) <= 5) {
                return `${y}-${mo.padStart(2,'0')}-${w}`;
            }
        }

        // ── 배민: 날짜 범위 패턴 ────────────────────────────
        // "20260422~20260428" / "2026-04-22~2026-04-28"
        m = filename.match(/(\d{4})[\-]?(\d{2})[\-]?(\d{2})[~_\s]/);
        if (m) {
            const [, y, mo, day] = m;
            const weekNum = Math.ceil(parseInt(day, 10) / 7);
            return `${y}-${mo}-${weekNum}`;
        }

        return null; // 패턴 미감지
    },

    // 배민 날짜범위 → 주차 변환 (수동 변환기)
    _convertBaeminDate() {
        const input = document.getElementById('baemin-date-range');
        const resultEl = document.getElementById('baemin-convert-result');
        const raw = (input?.value || '').trim();
        if (!raw) { alert('날짜범위를 입력해주세요. (예: 20260422~20260428)'); return; }

        // "20260422~20260428" 또는 "2026-04-22~2026-04-28" 형식 모두 지원
        const cleaned = raw.replace(/[^0-9~\-]/g, '');
        const startStr = cleaned.split('~')[0].replace(/-/g, '');

        if (startStr.length < 8) {
            alert('날짜 형식이 올바르지 않습니다.\n입력 예시: 20260422~20260428');
            return;
        }

        const year  = startStr.slice(0, 4);
        const month = startStr.slice(4, 6);
        const day   = parseInt(startStr.slice(6, 8), 10);

        // 해당 월의 주차 계산: ceil(일 / 7)
        const weekNum = Math.ceil(day / 7);
        const weekLabel = `${year}-${month}-${weekNum}`;

        // 결과 표시
        resultEl.textContent = `✅ 변환 결과: ${weekLabel} (${parseInt(month)}월 ${weekNum}주차)`;
        resultEl.classList.remove('hidden');

        // 첫 번째 빈 주차 입력란에 자동 입력
        let filled = false;
        for (const row of this._baeminRows) {
            const el = document.getElementById(`week-baemin-${row.id}`);
            if (el && !el.value.trim()) {
                el.value = weekLabel;
                el.classList.add('ring-2', 'ring-teal-400');
                setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400'), 1500);
                filled = true;
                break;
            }
        }
        if (!filled) {
            // 빈 칸이 없으면 클립보드에 복사
            navigator.clipboard?.writeText(weekLabel).then(() => {
                resultEl.textContent += ' (클립보드에 복사됨)';
            }).catch(() => {
                resultEl.textContent += ` → 직접 복사: ${weekLabel}`;
            });
        }
    },

    _removeUploadRow(platform, id) {
        if (platform === 'baemin') {
            if (this._baeminRows.length <= 1) return; // 최소 1행 유지
            this._baeminRows = this._baeminRows.filter(r => r.id !== id);
        } else {
            if (this._coupangRows.length <= 1) return;
            this._coupangRows = this._coupangRows.filter(r => r.id !== id);
        }
        const el = document.getElementById(`upload-row-${platform}-${id}`);
        if (el) el.remove();
    },

    async _uploadAllRows(platform) {
        const rows = platform === 'baemin' ? this._baeminRows : this._coupangRows;
        const riders = incomeDb.getRiders();
        if (riders.length === 0) { alert('먼저 라이더를 등록해주세요.'); return; }

        const resultDiv = document.getElementById('income-upload-result');
        resultDiv.innerHTML = `<div class="glass-panel rounded-xl p-5 text-center text-gray-500">⏳ 파싱 중...</div>`;

        const results = [];
        let totalSaved = 0;

        for (const row of rows) {
            const weekEl = document.getElementById(`week-${platform}-${row.id}`);
            const fileEl = document.getElementById(`file-${platform}-${row.id}`);
            const weekLabel = weekEl?.value.trim();
            const region    = document.getElementById(`region-${platform}-${row.id}`)?.value.trim() || '';
            const files = Array.from(fileEl?.files || []);

            if (!weekLabel || files.length === 0) {
                results.push({ week: weekLabel || '(주차 미입력)', status: 'skip', msg: '주차 또는 파일 미입력' });
                continue;
            }

            const allMatched = [], allUnmatched = [];
            const fileErrors = [];

            for (const file of files) {
                try {
                    const parsed = platform === 'baemin'
                        ? await IncomeExcelParser.parseBaemin(file, riders)
                        : await IncomeExcelParser.parseCoupang(file, riders);
                    allMatched.push(...parsed.matched);
                    allUnmatched.push(...parsed.unmatched);
                } catch (err) {
                    fileErrors.push({ name: file.name, error: err.message });
                }
            }

            // 라이더별 금액 합산
            const mergedMap = {};
            allMatched.forEach(rec => {
                if (!mergedMap[rec.riderId]) mergedMap[rec.riderId] = { ...rec };
                else mergedMap[rec.riderId].amount += rec.amount;
            });
            const mergedMatched = Object.values(mergedMap);

            if (mergedMatched.length > 0) {
                incomeDb.addSettlementBatch(platform, weekLabel, mergedMatched, region);
                totalSaved++;
            }

            results.push({
                week: weekLabel, region,
                status: mergedMatched.length > 0 ? 'ok' : 'warn',
                matched: mergedMatched.length,
                unmatched: allUnmatched.length,
                errors: fileErrors,
                unmatchedNames: allUnmatched.map(u => u.name || u.rawName).join(', ')
            });
        }

        const rowsHtml = results.map(r => {
            if (r.status === 'skip') return `
                <div class="flex items-center gap-3 py-2 border-b border-gray-100">
                    <span class="text-gray-400 text-xs">⏭️</span>
                    <span class="text-sm text-gray-500">${r.week} — ${r.msg}</span>
                </div>`;
            const icon = r.status === 'ok' ? '✅' : '⚠️';
            const color = r.status === 'ok' ? 'text-green-700' : 'text-yellow-700';
            const regionTag = r.region ? `<span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">${r.region}</span>` : '';
            const errHtml = r.errors?.map(e => `<span class="text-red-600 text-xs">❌ ${e.name}: ${e.error}</span>`).join('');
            return `
                <div class="flex flex-wrap items-start gap-2 py-2 border-b border-gray-100">
                    <span class="text-sm">${icon}</span>
                    <span class="font-bold text-sm text-gray-800">${r.week}</span>
                    ${regionTag}
                    <span class="text-sm ${color}">매칭: ${r.matched}명 | 미매칭: ${r.unmatched}건</span>
                    ${r.unmatchedNames ? `<span class="text-xs text-yellow-600">(${r.unmatchedNames})</span>` : ''}
                    ${errHtml || ''}
                </div>`;
        }).join('');

        resultDiv.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <p class="font-bold text-gray-800 mb-3">📋 업로드 결과 — ${totalSaved}개 주차 저장 완료</p>
                ${rowsHtml}
            </div>`;

        // ★ 완료 후 행 초기화 (1개로 리셋)
        const newId = this._nextRowId++;
        if (platform === 'baemin') this._baeminRows = [{ id: newId }];
        else this._coupangRows = [{ id: newId }];
        const container = document.getElementById(`${platform}-upload-rows`);
        if (container) {
            container.innerHTML = `
                <div id="upload-row-${platform}-${newId}" class="flex gap-2 items-center mb-2">
                    <input type="text" id="week-${platform}-${newId}" placeholder="주차 (2026-04-4)"
                        class="w-28 border rounded-lg px-2 py-2 text-sm flex-shrink-0">
                    <input type="text" id="region-${platform}-${newId}" placeholder="권역 (예:강남)"
                        class="w-24 border rounded-lg px-2 py-2 text-sm flex-shrink-0">
                    <input type="file" id="file-${platform}-${newId}" accept=".xlsx,.xls" multiple
                        onchange="incomeApp._autoDetectWeek('${platform}', ${newId}, this)"
                        class="flex-1 text-sm border rounded-lg px-2 py-2">
                    <button onclick="incomeApp._removeUploadRow('${platform}',${newId})"
                        class="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg hover:border-red-300 transition-all">
                        <i data-lucide='x' class='w-4 h-4'></i>
                    </button>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    },

    // ── 탭: 업로드 내역 ───────────────────────────────────
    _renderBatches() {
        const batches = incomeDb.getSettlements().slice().reverse();
        if (batches.length === 0) return `
            <div class="glass-panel rounded-xl p-12 text-center text-gray-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3"></i>
                <p>업로드된 정산서가 없습니다.</p>
            </div>`;

        // 주차 + 플랫폼 단위로 그룹핑
        const groups = {};
        batches.forEach(b => {
            const key = `${b.platform}|${b.weekLabel}`;
            if (!groups[key]) groups[key] = { platform: b.platform, weekLabel: b.weekLabel, items: [] };
            groups[key].items.push(b);
        });

        const groupHtml = Object.values(groups).map(g => {
            const badge = g.platform === 'baemin'
                ? '<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-teal-100 text-teal-700">배민</span>'
                : '<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">쿠팡</span>';

            const subItems = g.items.map(b => {
                const regionTag = b.region
                    ? `<span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">${b.region}</span>`
                    : `<span class="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full">권역미입력</span>`;
                return `
                    <div class="flex items-center justify-between py-2 pl-5 border-b border-gray-50 last:border-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-gray-300 text-xs">└</span>
                            ${regionTag}
                            <span class="text-xs text-gray-500">${b.records.length}명 반영</span>
                            <span class="text-xs text-gray-400">${new Date(b.uploadedAt).toLocaleString('ko-KR')}</span>
                        </div>
                        <button onclick="incomeApp._deleteBatch('${b.batchId}','${b.weekLabel}')"
                            class="text-red-400 hover:text-red-600 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 flex-shrink-0">삭제</button>
                    </div>`;
            }).join('');

            return `
                <div class="glass-panel rounded-xl border border-gray-100 mb-3 overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <div class="flex items-center gap-3">
                            ${badge}
                            <span class="font-bold text-gray-800">${g.weekLabel}</span>
                            <span class="text-xs text-gray-400">${g.items.length}개 권역</span>
                        </div>
                        <span class="text-xs text-gray-400">총 ${g.items.reduce((s,b)=>s+b.records.length,0)}명</span>
                    </div>
                    ${subItems}
                </div>`;
        }).join('');

        return `
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-gray-800">업로드된 정산서 목록 (${batches.length}건)</h3>
                <p class="text-xs text-gray-400">※ 관리자가 직접 삭제하기 전까지 영구 보존됩니다.</p>
            </div>
            ${groupHtml}`;
    },

    // ── 이벤트 핸들러 ─────────────────────────────────────
    _addRider(e) {
        e.preventDefault();
        try {
            incomeDb.addRider({
                name: document.getElementById('ir-name').value,
                phone: document.getElementById('ir-phone').value,
                residentNo: document.getElementById('ir-resident').value,
                baeminId: document.getElementById('ir-baemin').value,
                coupangLast4: document.getElementById('ir-coupang').value
            });
            alert('라이더가 등록되었습니다.');
            this.render(document.getElementById('app-content'));
        } catch (err) {
            alert(err.message);
        }
    },

    _deleteRider(id, name) {
        if (!confirm(`[${name}] 라이더를 삭제하시겠습니까?\n관련 정산 내역은 유지됩니다.`)) return;
        incomeDb.deleteRider(id);
        this.render(document.getElementById('app-content'));
    },

    async _bulkUpload() {
        const file = document.getElementById('bulk-rider-file').files[0];
        if (!file) { alert('파일을 선택해주세요.'); return; }
        try {
            const riderList = await IncomeExcelParser.parseRiderBulk(file);
            if (riderList.length === 0) { alert('유효한 데이터가 없습니다. 양식을 확인해주세요.'); return; }
            const result = incomeDb.bulkAddRiders(riderList);
            alert(`등록 완료!\n✅ 추가: ${result.added}명\n⏭️ 중복 스킵: ${result.skipped.length}명`);
            this.render(document.getElementById('app-content'));
        } catch (err) {
            alert('파일 파싱 오류: ' + err.message);
        }
    },

    async _uploadSettlement(platform) {
        const fileEl = document.getElementById(`file-income-${platform}`);
        const weekEl = document.getElementById(`${platform}-week`);
        const resultDiv = document.getElementById('income-upload-result');

        const files = Array.from(fileEl.files);
        if (files.length === 0) { alert('파일을 선택해주세요.'); return; }
        if (!weekEl.value.trim()) { alert('주차를 입력해주세요. (예: 2026-05-01)'); return; }

        const riders = incomeDb.getRiders();
        if (riders.length === 0) { alert('먼저 라이더를 등록해주세요.'); return; }

        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = `<div class="glass-panel rounded-xl p-6 text-center text-gray-500">⏳ ${files.length}개 파일 파싱 중...</div>`;

        // 여러 파일 결과 합산
        const allMatched = [];
        const allUnmatched = [];
        const fileErrors = [];

        for (const file of files) {
            try {
                let parsed;
                if (platform === 'baemin') {
                    parsed = await IncomeExcelParser.parseBaemin(file, riders);
                } else {
                    parsed = await IncomeExcelParser.parseCoupang(file, riders);
                }
                allMatched.push(...parsed.matched);
                allUnmatched.push(...parsed.unmatched);
            } catch (err) {
                fileErrors.push({ name: file.name, error: err.message });
            }
        }

        // 라이더별 금액 합산 (같은 라이더가 여러 파일에 있을 경우)
        const mergedMap = {};
        allMatched.forEach(rec => {
            if (!mergedMap[rec.riderId]) {
                mergedMap[rec.riderId] = { ...rec };
            } else {
                mergedMap[rec.riderId].amount += rec.amount;
            }
        });
        const mergedMatched = Object.values(mergedMap);

        if (mergedMatched.length === 0 && fileErrors.length === 0) {
            resultDiv.innerHTML = `
                <div class="glass-panel rounded-xl p-6 border border-yellow-200 bg-yellow-50">
                    <p class="font-bold text-yellow-800 mb-2">⚠️ 매칭된 라이더가 없습니다.</p>
                    <p class="text-sm text-yellow-700">미매칭: ${allUnmatched.length}건 — 라이더 등록 정보(배민ID/쿠팡뒷번호)를 확인해주세요.</p>
                </div>`;
            return;
        }

        if (mergedMatched.length > 0) {
            incomeDb.addSettlementBatch(platform, weekEl.value.trim(), mergedMatched);
        }

        const unmatchedHtml = allUnmatched.length > 0
            ? `<p class="text-sm text-yellow-700 mt-2">⚠️ 미매칭 ${allUnmatched.length}건: ${allUnmatched.map(u => u.name || u.rawName).join(', ')}</p>`
            : '';
        const errorHtml = fileErrors.map(fe =>
            `<p class="text-sm text-red-700 mt-1">❌ ${fe.name}: ${fe.error}</p>`
        ).join('');

        resultDiv.innerHTML = `
            <div class="glass-panel rounded-xl p-6 border border-green-200 bg-green-50">
                <p class="font-bold text-green-800 mb-1">✅ 업로드 완료! (${files.length}개 파일)</p>
                <p class="text-sm text-green-700">매칭 성공: ${mergedMatched.length}명 | 미매칭: ${allUnmatched.length}건 | 오류: ${fileErrors.length}건</p>
                ${unmatchedHtml}${errorHtml}
                <p class="text-xs text-gray-400 mt-2">📌 파서 정보: ${files.map((f,i) => f.name).join(', ')}</p>
            </div>`;
    },

    _deleteBatch(batchId, weekLabel) {
        if (!confirm(`[${weekLabel}] 정산 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
        incomeDb.deleteSettlementBatch(batchId);
        this.render(document.getElementById('app-content'));
    },

    _downloadSummary() {
        // 현재 필터가 적용된 상태로 다운로드
        const allWeeks = incomeDb.getUniqueWeekLabels();
        const filteredWeeks = (this._filterYear || this._filterMonth)
            ? allWeeks.filter(w => {
                const parts = w.split('-');
                const y = parts[0] || '';
                const m = (parts[1] || '').padStart(2,'0');
                if (this._filterYear  && y !== this._filterYear)  return false;
                if (this._filterMonth && m !== this._filterMonth) return false;
                return true;
              })
            : allWeeks;
        const summary = (this._filterYear || this._filterMonth)
            ? incomeDb.getSummaryByRiderFiltered(filteredWeeks)
            : incomeDb.getSummaryByRider();
        if (summary.length === 0) { alert('다운로드할 데이터가 없습니다.'); return; }
        IncomeExcelParser.downloadSummaryExcel(summary, filteredWeeks);
    }
};
