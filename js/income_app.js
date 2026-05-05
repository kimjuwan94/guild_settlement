/**
 * 소득신고 정산 관리 - UI 렌더링 모듈
 * 기존 app.js와 완전 독립. incomeApp.render(container) 로 호출
 */
const incomeApp = {
    _tab: 'summary', // 'summary' | 'riders' | 'upload' | 'batches'

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
        const weeks = incomeDb.getUniqueWeekLabels();
        const summary = incomeDb.getSummaryByRider();
        const totalBaemin = summary.reduce((s, r) => s + r.baemin, 0);
        const totalCoupang = summary.reduce((s, r) => s + r.coupang, 0);
        const totalAll = totalBaemin + totalCoupang;

        const rows = summary.map(r => `
            <tr class="border-b border-gray-100 hover:bg-indigo-50">
                <td class="py-3 px-4 font-semibold text-gray-800">${r.name}</td>
                <td class="py-3 px-4 text-gray-500 text-xs">${r.phone}</td>
                <td class="py-3 px-4 text-teal-700 font-mono">${r.baemin.toLocaleString()}원</td>
                <td class="py-3 px-4 text-red-600 font-mono">${r.coupang.toLocaleString()}원</td>
                <td class="py-3 px-4 font-black text-indigo-700 font-mono">${r.total.toLocaleString()}원</td>
            </tr>`).join('') || `<tr><td colspan="5" class="text-center py-8 text-gray-400">등록된 라이더 또는 정산 데이터가 없습니다.</td></tr>`;

        return `
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
                    <h3 class="font-bold text-gray-800">라이더별 수입 집계 (${summary.length}명)</h3>
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
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="glass-panel rounded-xl border border-teal-200 p-6 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                    <h3 class="font-bold text-gray-800 mb-1 flex items-center">
                        <i data-lucide="bike" class="w-5 h-5 mr-2 text-teal-600"></i> 배민 주정산서 업로드
                    </h3>
                    <p class="text-xs text-gray-500 mb-4">시트: "을지_협력사_소속_라이더정산_확인용"<br>컬럼: 라이더명, user ID, 라이더별정산금액</p>
                    <input type="text" id="baemin-week" placeholder="주차 입력 (예: 2026-05-01)" class="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                    <input type="file" id="file-income-baemin" accept=".xlsx,.xls" multiple class="w-full text-sm border rounded-lg px-3 py-2 mb-1">
                    <p class="text-xs text-teal-600 mb-3">※ Ctrl(또는 Cmd)키로 여러 파일 동시 선택 가능</p>
                    <button onclick="incomeApp._uploadSettlement('baemin')" class="w-full bg-teal-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-teal-700 transition-all">
                        파싱 및 반영
                    </button>
                </div>
                <div class="glass-panel rounded-xl border border-red-200 p-6 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                    <h3 class="font-bold text-gray-800 mb-1 flex items-center">
                        <i data-lucide="truck" class="w-5 h-5 mr-2 text-red-600"></i> 쿠팡 주정산서 업로드
                    </h3>
                    <p class="text-xs text-gray-500 mb-4">시트: "종합"<br>컬럼: 성함 (홍길동1234), 라이더별실지급액</p>
                    <input type="text" id="coupang-week" placeholder="주차 입력 (예: 2026-05-01)" class="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-red-500 focus:outline-none">
                    <input type="file" id="file-income-coupang" accept=".xlsx,.xls" multiple class="w-full text-sm border rounded-lg px-3 py-2 mb-1">
                    <p class="text-xs text-red-500 mb-3">※ Ctrl(또는 Cmd)키로 여러 파일 동시 선택 가능</p>
                    <button onclick="incomeApp._uploadSettlement('coupang')" class="w-full bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 transition-all">
                        파싱 및 반영
                    </button>
                </div>
            </div>
            <div id="income-upload-result" class="hidden"></div>`;
    },

    // ── 탭: 업로드 내역 ───────────────────────────────────
    _renderBatches() {
        const batches = incomeDb.getSettlements().slice().reverse();
        if (batches.length === 0) return `
            <div class="glass-panel rounded-xl p-12 text-center text-gray-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3"></i>
                <p>업로드된 정산서가 없습니다.</p>
            </div>`;

        const rows = batches.map(b => `
            <div class="glass-panel rounded-xl border border-gray-100 p-5 mb-3">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="inline-block px-2 py-0.5 text-xs font-bold rounded-full mr-2 ${b.platform === 'baemin' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}">
                            ${b.platform === 'baemin' ? '배민' : '쿠팡'}
                        </span>
                        <span class="font-bold text-gray-800">${b.weekLabel}</span>
                        <span class="text-xs text-gray-400 ml-3">${new Date(b.uploadedAt).toLocaleString('ko-KR')}</span>
                        <span class="text-xs text-gray-500 ml-3">매칭 ${b.records.length}건</span>
                    </div>
                    <button onclick="incomeApp._deleteBatch('${b.batchId}','${b.weekLabel}')"
                        class="text-red-400 hover:text-red-600 text-xs px-3 py-1 border border-red-200 rounded hover:bg-red-50">삭제</button>
                </div>
            </div>`).join('');

        return `
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-gray-800">업로드된 정산서 목록 (${batches.length}건)</h3>
                <p class="text-xs text-gray-400">※ 관리자가 직접 삭제하기 전까지 영구 보존됩니다.</p>
            </div>
            ${rows}`;
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
            </div>`;
    },

    _deleteBatch(batchId, weekLabel) {
        if (!confirm(`[${weekLabel}] 정산 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
        incomeDb.deleteSettlementBatch(batchId);
        this.render(document.getElementById('app-content'));
    },

    _downloadSummary() {
        const summary = incomeDb.getSummaryByRider();
        if (summary.length === 0) { alert('다운로드할 데이터가 없습니다.'); return; }
        IncomeExcelParser.downloadSummaryExcel(summary, incomeDb.getUniqueWeekLabels());
    }
};
