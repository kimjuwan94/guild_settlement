const app = {
    state: {
        currentUser: null, // { role: 'admin'|'gm', id: string, guild?: object }
        currentView: 'dashboard-gm',
    },

    async init() {
        // ?쒕쾭?먯꽌 ?곗씠??遺덈윭?ㅺ린 ?湲?        await db.loadFromServer();

        // Run auto-finalize check every time the app loads
        const finalizedOldWeek = db.checkAndAutoFinalize(SettlementEngine);
        if (finalizedOldWeek) {
            console.log(`System auto-finalized week: ${finalizedOldWeek}`);
            // We can optionally show a toast notification here if we had a toast system
        }

        // Check session or show login
        const savedSession = sessionStorage.getItem('guildSysSession');
        if (savedSession) {
            this.state.currentUser = JSON.parse(savedSession);
            document.getElementById('login-screen').classList.add('hidden');
            this.updateUserUI();
            this.navigate(this.state.currentUser.role === 'admin' ? 'admin-overview' : 'dashboard-gm');
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
        }
    },

    handleLogin(e) {
        e.preventDefault();
        const idInput = document.getElementById('login-id').value;
        const pwInput = document.getElementById('login-pw').value;
        const errorDiv = document.getElementById('login-error');

        const user = db.authenticate(idInput, pwInput);
        
        if (user) {
            this.state.currentUser = user;
            sessionStorage.setItem('guildSysSession', JSON.stringify(user));
            document.getElementById('login-screen').classList.add('hidden');
            errorDiv.classList.add('hidden');
            
            // Re-run auto check just in case day crossed while sitting on login screen
            const finalizedOldWeek = db.checkAndAutoFinalize(SettlementEngine);
            if (finalizedOldWeek) {
                alert(`?쒓컙??吏???뺤궛 二쇨린媛 蹂寃쎈릺?덉뒿?덈떎.\n吏??二쇱감(${finalizedOldWeek})媛 ?먮룞?쇰줈 留덇컧 諛???λ릺?덉뒿?덈떎.`);
            }

            this.updateUserUI();
            
            // Navigate based on role
            this.navigate(user.role === 'admin' ? 'admin-overview' : 'dashboard-gm');
        } else {
            errorDiv.innerText = '?꾩씠???먮뒗 鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎.';
            errorDiv.classList.remove('hidden');
        }
    },

    logout() {
        sessionStorage.removeItem('guildSysSession');
        this.state.currentUser = null;
        document.getElementById('login-id').value = '';
        document.getElementById('login-pw').value = '';
        document.getElementById('login-screen').classList.remove('hidden');
    },

    updateUserUI() {
        if (!this.state.currentUser) return;
        
        const isGm = this.state.currentUser.role === 'gm';
        const guild = isGm ? this.state.currentUser.guild : null;
        
        const isAdmin = this.state.currentUser.role === 'admin';
        const isImpersonating = this.state.currentUser.impersonatedByAdmin === true;

        document.getElementById('current-user-avatar').innerText = !isAdmin ? 'GM' : 'A';
        document.getElementById('current-user-avatar').className = !isAdmin 
            ? "w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold"
            : "w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold";
            
        document.getElementById('current-user-name').innerText = !isAdmin ? guild.gmName : '理쒓퀬 愿由ъ옄';
        document.getElementById('current-user-role').innerText = !isAdmin ? guild.name : 'System Admin';

        // Toggle nav items based on role
        document.getElementById('nav-dashboard-gm').style.display = !isAdmin ? 'flex' : 'none';
        document.getElementById('nav-members').style.display = !isAdmin ? 'flex' : 'none';
        document.getElementById('nav-history').style.display = !isAdmin ? 'flex' : 'none'; // GM Only
        document.getElementById('nav-upload').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN
        document.getElementById('nav-admin-overview').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('nav-admin-history').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN
        document.getElementById('nav-admin-approvals').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN

        // Switch Account Buttons
        document.getElementById('btn-switch-account').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('btn-return-admin').style.display = isImpersonating ? 'flex' : 'none';
    },

    navigate(view) {
        this.state.currentView = view;
        
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('nav-active'));
        const activeNav = document.getElementById(`nav-${view}`);
        if(activeNav) activeNav.classList.add('nav-active');

        const contentArea = document.getElementById('app-content');
        const titleArea = document.getElementById('page-title');
        const currentWeekName = db.getCurrentWeekName();

        switch(view) {
            case 'dashboard-gm':
                titleArea.innerText = `?대쾲 二???쒕낫??(${currentWeekName})`;
                this.renderDashboard(contentArea);
                break;
            case 'members':
                titleArea.innerText = `?뚯냽 湲몃뱶??愿由?(${currentWeekName})`;
                this.renderMembers(contentArea);
                break;
            case 'history':
                titleArea.innerText = '怨쇨굅 ?뺤궛 ?댁뿭';
                this.renderHistory(contentArea);
                break;
            case 'upload':
                titleArea.innerText = '?꾩껜 湲몃뱶 ?뺤궛???낅줈??(Admin)';
                this.renderUpload(contentArea);
                break;
            case 'admin-overview':
                titleArea.innerText = `?꾩껜 湲몃뱶 ?듯빀 ?꾪솴 (${currentWeekName})`;
                this.renderAdmin(contentArea);
                break;
            case 'admin-history':
                titleArea.innerText = '怨쇨굅 ?뺤궛 諛?吏湲?愿由?(Admin)';
                this.renderAdminHistory(contentArea);
                break;
            case 'admin-approvals':
                titleArea.innerText = '?좉퇋 湲몃뱶??媛???뱀씤 (Admin)';
                this.renderAdminApprovals(contentArea);
                break;
        }
    },

    // --- Views ---

    renderDashboard(container) {
        if (this.state.currentUser.role === 'admin') return;

        const guildId = this.state.currentUser.id;
        const activeCount = db.getHeadcountForGuild(guildId);
        const totalDeliveries = db.getTotalDeliveriesForGuild(guildId);
        
        const result = SettlementEngine.calculateSettlement(activeCount, totalDeliveries);

        const globalNotice = db.getNotice();
        const noticeHtml = globalNotice ? `
            <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded shadow-sm flex items-start">
                <i data-lucide="bell-ring" class="w-5 h-5 text-red-500 mr-3 mt-0.5"></i>
                <div>
                    <h4 class="text-sm font-bold text-red-800 mb-1">蹂몄궗 湲닿툒 怨듭??ы빆</h4>
                    <p class="text-sm text-red-700 whitespace-pre-wrap">${globalNotice}</p>
                </div>
            </div>
        ` : '';

        // Get members for Top 3
        const guildMembers = db.getMembers(guildId).filter(m => m.status === 'approved');
        const sortedMembers = [...guildMembers].sort((a, b) => b.deliveries - a.deliveries).slice(0, 3);
        const top3Html = sortedMembers.map((m, idx) => {
            const colors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
            const bgColors = ['bg-yellow-50', 'bg-gray-50', 'bg-amber-50'];
            return `
                <div class="flex items-center justify-between p-3 ${bgColors[idx]} rounded-lg border border-gray-100 mb-2">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center mr-3 font-bold ${colors[idx]}">
                            ${idx + 1}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800">${m.name}</p>
                            <p class="text-xs text-gray-500">${m.baeminId || 'ID?놁쓬'}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold text-gray-900">${(m.deliveries || 0).toLocaleString()}嫄?/p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            ${noticeHtml}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="glass-panel p-6 rounded-xl border border-gray-100">
                    <div class="flex items-center text-gray-500 mb-2">
                        <i data-lucide="users" class="w-5 h-5 mr-2 text-blue-500"></i>
                        <span class="font-medium text-sm">?꾩옱 ?뚯냽 ?몄썝 (湲몃뱶???ы븿)</span>
                    </div>
                    <div class="text-3xl font-bold text-gray-900">${activeCount}<span class="text-lg font-normal text-gray-500 ml-1">紐?/span></div>
                </div>

                <div class="glass-panel p-6 rounded-xl border border-gray-100">
                    <div class="flex items-center text-gray-500 mb-2">
                        <i data-lucide="bike" class="w-5 h-5 mr-2 text-orange-500"></i>
                        <span class="font-medium text-sm">二쇨컙 ?꾩쟻 諛곕떖嫄댁닔</span>
                    </div>
                    <div class="text-3xl font-bold text-gray-900">${totalDeliveries.toLocaleString()}<span class="text-lg font-normal text-gray-500 ml-1">嫄?/span></div>
                </div>

                <div class="glass-panel p-6 rounded-xl border border-gray-100 bg-gradient-to-br from-primary-50 to-white">
                    <div class="flex items-center text-primary-700 mb-2">
                        <i data-lucide="award" class="w-5 h-5 mr-2"></i>
                        <span class="font-medium text-sm">?꾩옱 ?덉긽 ?깃툒</span>
                    </div>
                    <div class="text-3xl font-bold text-primary-700">${result.tier}</div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div class="lg:col-span-2 glass-panel rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col h-full">
                    <h3 class="text-lg font-semibold mb-4 text-gray-800 border-b pb-2 flex items-center">
                        <i data-lucide="trending-up" class="w-5 h-5 mr-2 text-primary-600"></i> 理쒓렐 4二쇨컙 ?ㅼ쟻 異붿씠
                    </h3>
                    <div class="flex-grow w-full relative min-h-[250px]">
                        <canvas id="dashboardChart"></canvas>
                    </div>
                </div>
                
                <div class="glass-panel rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col h-full">
                    <h3 class="text-lg font-semibold mb-4 text-gray-800 border-b pb-2 flex items-center">
                        <i data-lucide="crown" class="w-5 h-5 mr-2 text-yellow-500"></i> ?대쾲 二?紐낆삁???꾨떦 (TOP 3)
                    </h3>
                    <div class="flex-grow flex flex-col justify-center">
                        ${sortedMembers.length > 0 ? top3Html : '<p class="text-center text-sm text-gray-500 py-4">?꾩쭅 ?ㅼ쟻???깅줉??湲몃뱶?먯씠 ?놁뒿?덈떎.</p>'}
                    </div>
                </div>
            </div>

            <div class="glass-panel rounded-xl border border-gray-100 p-8 shadow-sm">
                <h3 class="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">?덉긽 ?뺤궛 寃곌낵 (?붿슂??留덇컧 湲곗?)</h3>
                <div class="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-600">?몄젙 諛곕떖 嫄댁닔 (Limit Cap ?곸슜)</span>
                        <span class="font-semibold text-gray-900">${result.recognizedDeliveries.toLocaleString()} 嫄?/span>
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-600">?곸슜 ?④? (1,000嫄대떦)</span>
                        <span class="font-semibold text-gray-900">${result.pricePer1000 ? result.pricePer1000.toLocaleString() : 0} ??/span>
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-600">?뺤궛 釉붾줉??/span>
                        <span class="font-semibold text-gray-900">${result.chunks} 臾띠쓬</span>
                    </div>
                    <hr class="my-4 border-gray-200">
                    <div class="flex justify-between items-center text-xl">
                        <span class="font-bold text-gray-800">?덉긽 吏湲됱븸</span>
                        <span class="font-bold text-primary-600">${result.totalAmount.toLocaleString()} ??/span>
                    </div>
                    ${result.message.includes('誘몃떖') ? `<p class="text-sm text-red-500 mt-4 font-medium">${result.message}</p>` : ''}
                </div>
            </div>
        `;
        lucide.createIcons();
        
        // Render Chart.js
        setTimeout(() => this.renderChart(guildId), 50);
    },

    renderChart(guildId) {
        const canvas = document.getElementById('dashboardChart');
        if (!canvas) return;

        const settlements = db.getSettlementsByGuild(guildId);
        // Get last 4 weeks (or less if not available)
        const recentSettlements = settlements.slice(0, 4).reverse();
        
        let labels = [];
        let dataPoints = [];

        if (recentSettlements.length === 0) {
            labels = ['-'];
            dataPoints = [0];
        } else {
            labels = recentSettlements.map(s => s.weekName.replace('??', '\n').replace('??', '/').replace('二쇱감', '二?));
            dataPoints = recentSettlements.map(s => s.totalDeliveries);
        }

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '二쇨컙 珥?諛곕떖 嫄댁닔',
                    data: dataPoints,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#4f46e5',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#f3f4f6' } },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    renderHistory(container) {
        if (this.state.currentUser.role === 'admin') return;
        
        const guildId = this.state.currentUser.id;
        const settlements = db.getSettlementsByGuild(guildId);
        
        if (settlements.length === 0) {
            container.innerHTML = `
                <div class="glass-panel rounded-xl border border-gray-100 p-12 text-center">
                    <i data-lucide="inbox" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">怨쇨굅 ?뺤궛 ?댁뿭???놁뒿?덈떎</h3>
                    <p class="text-sm text-gray-500">?꾩쭅 ?섏슂?쇱씠 ?섏뼱 ?먮룞 留덇컧???뺤궛 湲곕줉??議댁옱?섏? ?딆뒿?덈떎.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        let historyRows = settlements.map(s => `
            <div class="glass-panel p-6 rounded-xl border border-gray-100 mb-4 hover:border-blue-300 transition-colors relative">
                ${s.isPaid ? 
                    '<div class="absolute top-4 right-6 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full border border-green-200 shadow-sm"><i data-lucide="check-circle-2" class="w-3 h-3 inline mr-1"></i>蹂몄궗 吏湲??꾨즺</div>' : 
                    '<div class="absolute top-4 right-6 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full border border-orange-200 shadow-sm"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>吏湲??湲?以?/div>'}
                <div class="flex justify-between items-center border-b border-gray-100 pb-3 mb-4 mt-2">
                    <h4 class="text-lg font-bold text-gray-900">${s.weekName}</h4>
                    <span class="text-sm text-gray-500">留덇컧 ?뱀씤?? ${s.date}</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p class="text-xs text-gray-500 mb-1">?ъ꽦 ?깃툒</p>
                        <p class="font-bold text-primary-700">${s.tier}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 mb-1">留덇컧 ?몄썝</p>
                        <p class="font-bold text-gray-800">${s.memberCount}紐?/p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 mb-1">珥?諛곕떖嫄댁닔 (?몄젙嫄댁닔)</p>
                        <p class="font-bold text-gray-800">${s.totalDeliveries.toLocaleString()}嫄?<span class="text-xs font-normal text-gray-400">(${s.recognizedDeliveries.toLocaleString()}嫄??몄젙)</span></p>
                    </div>
                    <div class="text-right border-l pl-4 border-gray-100">
                        <p class="text-xs text-gray-500 mb-1">理쒖쥌 吏湲??뺤젙??/p>
                        <p class="text-xl font-black text-blue-600">${s.totalAmount.toLocaleString()}??/p>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-6 flex items-center">
                    <i data-lucide="calendar-check" class="w-6 h-6 mr-2 text-primary-600"></i> 留ㅼ＜ ?섏슂???먮룞 留덇컧???뺤궛 湲곕줉
                </h3>
                ${historyRows}
            </div>
        `;
        lucide.createIcons();
    },

    renderMembers(container) {
        if (this.state.currentUser.role === 'admin') return;
        const guildId = this.state.currentUser.id;
        const members = db.getMembers(guildId);
        
        const getStatusBadge = (status) => {
            if(status === 'pending') return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">?뱀씤 ?湲곗쨷</span>';
            if(status === 'rejected') return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 ml-2">諛섎젮??/span>';
            return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 ml-2">?뱀씤 ?꾨즺</span>';
        };

        let rows = members.map(m => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 px-4 text-sm font-medium text-gray-900">${m.id}</td>
                <td class="py-3 px-4 text-sm text-gray-700 font-semibold">
                    ${m.name}
                    ${getStatusBadge(m.status)}
                    ${m.memo ? `<br><span class="text-xs text-gray-400 font-normal truncate max-w-[100px] inline-block" title="${m.memo}">?뱷 ${m.memo}</span>` : ''}
                </td>
                <td class="py-3 px-4 text-sm text-gray-700 font-mono">${m.baeminId || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-700 font-mono">${m.coupangPhone || '-'}</td>
                <td class="py-3 px-4 text-sm font-bold text-blue-600">${(m.deliveries || 0).toLocaleString()}嫄?/td>
                <td class="py-3 px-4 text-sm text-right">
                    <button type="button" onclick="app.deleteMember('${m.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">??젣</button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-semibold text-gray-800">?대쾲 二??뚯냽 湲몃뱶???꾩쟻 ?ㅼ쟻</h3>
                    <button onclick="document.getElementById('add-modal').classList.remove('hidden')" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center">
                        <i data-lucide="plus" class="w-4 h-4 mr-2"></i>?좉퇋 ?깅줉
                    </button>
                </div>

                <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 text-sm text-blue-700">
                    <p class="font-bold flex items-center mb-1"><i data-lucide="info" class="w-4 h-4 mr-1"></i> 湲몃뱶???깅줉 ?덈궡</p>
                    <p>?좉퇋濡??깅줉??湲몃뱶?먯? <b>[?뱀씤 ?湲곗쨷]</b> ?곹깭媛 ?섎ŉ, 蹂몄궗 理쒓퀬 愿由ъ옄??<b>理쒖쥌 ?뱀씤 ?댄썑???뺤떇 ?몄썝??諛??ㅼ쟻 ?⑹궛</b>??諛섏쁺?⑸땲?? ?깅줉 ??蹂몄궗???뱀씤 ?붿껌???댁＜?몄슂.</p>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 font-semibold rounded-tl-lg">?щ쾲</th>
                                <th class="py-3 px-4 font-semibold">?대쫫</th>
                                <th class="py-3 px-4 font-semibold">諛곕? ID</th>
                                <th class="py-3 px-4 font-semibold">荑좏뙜 ?룹옄由?/th>
                                <th class="py-3 px-4 font-semibold text-blue-700">?대쾲 二??꾩쟻 諛곕떖嫄댁닔</th>
                                <th class="py-3 px-4 font-semibold rounded-tr-lg text-right">愿由?/th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length > 0 ? rows : `<tr><td colspan="6" class="text-center py-8 text-gray-400">?깅줉??湲몃뱶?먯씠 ?놁뒿?덈떎.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="add-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                <div class="glass-panel w-full max-w-md p-6 rounded-xl shadow-xl">
                    <h3 class="text-lg font-semibold mb-4 border-b pb-2">?좉퇋 湲몃뱶???깅줉</h3>
                    <form id="add-member-form" onsubmit="app.addMember(event)">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">?대쫫 <span class="text-xs text-gray-500 font-normal">(?紐낆쓽 ?ъ슜???쇳몴濡?援щ텇. ?? ?띻만??源媛議?</span></label>
                                <input type="text" id="m-name" required placeholder="?띻만?? class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">諛곕? 而ㅻ꽖??ID <span class="text-xs text-gray-500 font-normal">(?좏깮, ?ㅼ쨷 ?쇳몴 媛??</span></label>
                                <input type="text" id="m-baemin" placeholder="hong123, kim123" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">荑좏뙜?댁툩 ?룹옄由?<span class="text-xs text-gray-500 font-normal">(?좏깮, ?ㅼ쨷 ?쇳몴 媛??</span></label>
                                <input type="text" id="m-coupang" placeholder="1234, 5678" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">硫붾え/鍮꾧퀬 <span class="text-xs text-gray-500 font-normal">(?좏깮)</span></label>
                                <input type="text" id="m-memo" placeholder="?? 源媛議?紐낆쓽 ?ъ슜" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-yellow-50">
                            </div>
                        </div>
                        <div class="mt-6 flex justify-end space-x-3">
                            <button type="button" onclick="document.getElementById('add-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">痍⑥냼</button>
                            <button type="submit" class="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700">???/button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    renderUpload(container) {
        if (this.state.currentUser.role !== 'admin') return;
        container.innerHTML = `
            <div class="max-w-3xl mx-auto space-y-6">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                    <i data-lucide="info" class="w-5 h-5 text-blue-500 mr-3 mt-0.5 shrink-0"></i>
                    <p class="text-sm text-blue-800 leading-relaxed">
                        <strong>?꾩껜 湲몃뱶 ?쇨큵 ?⑹궛 (Admin ?꾩슜)</strong><br/>
                        ?щ윭 ?묒? ?뚯씪???좏깮?섏뿬 ?낅줈?쒗븯硫?<b>?꾩껜 留덉뒪??湲몃뱶??DB</b>瑜?寃?됲븯??媛?湲몃뱶?μ쓽 ?꾪솴?먯뿉 諛곕떖 ?ㅼ쟻??怨꾩냽 ?꾩쟻 ?⑹궛(+)?⑸땲??<br/>
                        <span class="text-xs text-blue-600 font-semibold mt-1 inline-block">??留ㅼ＜ ?섏슂???먯젙??湲곗젏?쇰줈 ?쒖뒪???묒냽 ???먮룞?쇰줈 ?댁쟾 ?곗씠?곌? 留덇컧 泥섎━?섍퀬 珥덇린?붾맗?덈떎.</span>
                    </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="glass-panel p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 rounded-full bg-[#2ac1bc] flex items-center justify-center text-white font-bold mr-3">諛곕?</div>
                            <h3 class="font-semibold text-gray-800">諛곕떖?섎?議??묒? ?낅줈??/h3>
                        </div>
                        <input type="file" id="file-baemin" accept=".xlsx,.xls,.csv" multiple class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 mb-4 cursor-pointer"/>
                        <button onclick="app.processUpload('baemin')" class="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">?뚯씪 ?쇨큵 ?뚯떛 諛??꾩쟻</button>
                    </div>

                    <div class="glass-panel p-6 rounded-xl border border-gray-100 hover:border-primary-300 transition-colors">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 rounded-full bg-[#ff3232] flex items-center justify-center text-white font-bold mr-3">荑좏뙜</div>
                            <h3 class="font-semibold text-gray-800">荑좏뙜?댁툩 ?묒? ?낅줈??/h3>
                        </div>
                        <input type="file" id="file-coupang" accept=".xlsx,.xls,.csv" multiple class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 mb-4 cursor-pointer"/>
                        <button onclick="app.processUpload('coupang')" class="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">?뚯씪 ?쇨큵 ?뚯떛 諛??꾩쟻</button>
                    </div>
                </div>

                <div id="upload-result" class="hidden mt-6"></div>
            </div>
        `;
        lucide.createIcons();
    },

    renderAdmin(container) {
        if (this.state.currentUser.role !== 'admin') return;
        const guilds = db.getGuilds();
        const currentWeekName = db.getCurrentWeekName();
        
        let guildRows = guilds.map(g => {
            const activeCount = db.getHeadcountForGuild(g.id);
            const deliveries = db.getTotalDeliveriesForGuild(g.id);
            const settlement = SettlementEngine.calculateSettlement(activeCount, deliveries);
            
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-3 px-4 text-sm font-medium text-gray-900">${g.name}</td>
                    <td class="py-3 px-4 text-sm text-gray-700">${g.gmName}</td>
                    <td class="py-3 px-4 text-sm">
                        <div class="flex items-center space-x-2">
                            <div>
                                <div class="font-mono text-xs bg-gray-100 px-2 py-1 rounded inline-block">ID: ${g.username}</div>
                                <div class="font-mono text-xs bg-red-50 text-red-600 px-2 py-1 rounded inline-block mt-1">PW: ${g.password}</div>
                            </div>
                            <button onclick="app.promptEditAccount('${g.id}', '${g.username}', '${g.password}', '${g.bankName || ''}', '${g.accountNumber || ''}')" class="text-gray-400 hover:text-blue-600 transition-colors" title="怨꾩젙 諛?怨꾩쥖 ?뺣낫 ?섏젙">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-sm text-gray-700 text-center">${activeCount}紐?/td>
                    <td class="py-3 px-4 text-sm text-blue-600 font-bold text-center">${deliveries.toLocaleString()}嫄?/td>
                    <td class="py-3 px-4 text-sm font-medium text-primary-700 text-center">${settlement.tier}</td>
                    <td class="py-3 px-4 text-sm text-right font-bold text-gray-900">${settlement.totalAmount.toLocaleString()}??/td>
                    <td class="py-3 px-4 text-sm text-center">
                        <button onclick="app.switchToGuild('${g.id}')" class="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 font-bold text-xs flex items-center justify-center mx-auto transition-colors">
                            <i data-lucide="log-in" class="w-3 h-3 mr-1"></i> ?묒냽
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        const currentNotice = db.getNotice();

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <i data-lucide="bell-ring" class="w-5 h-5 mr-2 text-red-500"></i> ??湲몃뱶 ???怨듭??ы빆 愿由?                </h3>
                <div class="flex flex-col sm:flex-row gap-4">
                    <textarea id="admin-notice-input" rows="2" class="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="紐⑤뱺 湲몃뱶?μ쓽 ?붾㈃ 理쒖긽?⑥뿉 怨좎젙 ?몄텧??湲닿툒 怨듭??ы빆???낅젰?섏꽭?? 鍮꾩썙?먮㈃ ?몄텧?섏? ?딆뒿?덈떎.">${currentNotice}</textarea>
                    <button onclick="app.saveNotice()" class="bg-red-50 text-red-600 border border-red-200 px-6 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors whitespace-nowrap self-end sm:self-auto h-full min-h-[42px]">
                        怨듭? ?낅뜲?댄듃
                    </button>
                </div>
            </div>

            <div class="glass-panel rounded-xl border border-gray-100 p-6 mb-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-blue-50 w-64 h-full transform skew-x-12 translate-x-10 z-0"></div>
                <div class="relative z-10 flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">?대쾲 二??ㅼ떆媛?湲몃뱶 ?꾪솴 (珥?${guilds.length}媛?</h3>
                        <p class="text-sm font-bold text-blue-600 mt-1">
                            <i data-lucide="clock" class="w-4 h-4 inline mb-0.5"></i> 吏꾪뻾 以묒씤 二쇱감: ${currentWeekName}
                        </p>
                        <p class="text-xs text-gray-500 mt-1">?섏슂???먯젙??吏?섍퀬 ?ъ씠???묒냽 ???쒖뒪?쒖씠 ?먮룞?쇰줈 ?곗씠?곕? 留덇컧 泥섎━?섍퀬 由ъ뀑?⑸땲??</p>
                    </div>
                    <div class="flex space-x-3">
                        <button onclick="document.getElementById('admin-add-modal').classList.remove('hidden')" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm flex items-center">
                            <i data-lucide="plus" class="w-4 h-4 mr-2"></i>?좉퇋 湲몃뱶 ?앹꽦
                        </button>
                    </div>
                </div>
                
                <div class="overflow-x-auto relative z-10">
                    <table class="w-full text-left bg-white rounded-lg shadow-sm">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 font-semibold rounded-tl-lg">湲몃뱶紐?/th>
                                <th class="py-3 px-4 font-semibold">湲몃뱶?λ챸</th>
                                <th class="py-3 px-4 font-semibold">諛쒓툒??怨꾩젙 ?뺣낫</th>
                                <th class="py-3 px-4 font-semibold text-center">湲몃뱶????/th>
                                <th class="py-3 px-4 font-semibold text-center text-blue-700">?대쾲二??꾩쟻嫄댁닔</th>
                                <th class="py-3 px-4 font-semibold text-center">?덉긽 ?깃툒</th>
                                <th class="py-3 px-4 font-semibold text-right">?덉긽 ?뺤궛湲?/th>
                                <th class="py-3 px-4 font-semibold rounded-tr-lg text-center">?붾㈃ ?꾪솚</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${guildRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Admin Guild Creation Modal -->
            <div id="admin-add-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                <div class="glass-panel w-full max-w-md p-6 rounded-xl shadow-xl">
                    <h3 class="text-lg font-semibold mb-4 border-b pb-2">?좉퇋 湲몃뱶 諛??묒냽 怨꾩젙 ?앹꽦</h3>
                    <form id="add-guild-form" onsubmit="app.addGuild(event)">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">湲몃뱶紐?/label>
                                <input type="text" id="g-name" required placeholder="?? 援щ줈媛??湲몃뱶" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">湲몃뱶??GM) ?대쫫</label>
                                <input type="text" id="g-gmname" required placeholder="?? 源湲몃룞" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">?뺤궛 ??됰챸 <span class="text-xs font-normal">(?좏깮)</span></label>
                                    <input type="text" id="g-bankname" placeholder="援????? class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">怨꾩쥖踰덊샇 <span class="text-xs font-normal">(?좏깮)</span></label>
                                    <input type="text" id="g-account" placeholder="- ?놁씠 ?낅젰" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50">
                                </div>
                            </div>
                            <p class="text-xs text-gray-500">???앹꽦 ?꾨즺 ???묒냽???꾩씠?붿? ?꾩떆 鍮꾨?踰덊샇媛 ?먮룞 諛쒓툒?⑸땲??</p>
                        </div>
                        <div class="mt-6 flex justify-end space-x-3">
                            <button type="button" onclick="document.getElementById('admin-add-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">痍⑥냼</button>
                            <button type="submit" class="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700">?앹꽦?섍린</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Admin Account Edit Modal -->
            <div id="admin-edit-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                <div class="glass-panel w-full max-w-md p-6 rounded-xl shadow-xl">
                    <h3 class="text-lg font-semibold mb-4 border-b pb-2 text-blue-800"><i data-lucide="key-round" class="w-5 h-5 inline mr-1"></i>怨꾩젙 ?뺣낫 ?섏젙</h3>
                    <form id="edit-account-form" onsubmit="app.updateAccount(event)">
                        <input type="hidden" id="edit-g-id">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">?묒냽 ?꾩씠??蹂寃?/label>
                                <input type="text" id="edit-g-id-input" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">??鍮꾨?踰덊샇</label>
                                <input type="text" id="edit-g-pw-input" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="grid grid-cols-2 gap-3 mt-2">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">?뺤궛 ??됰챸</label>
                                    <input type="text" id="edit-g-bankname-input" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">怨꾩쥖踰덊샇</label>
                                    <input type="text" id="edit-g-account-input" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                                </div>
                            </div>
                        </div>
                        <div class="mt-6 flex justify-end space-x-3">
                            <button type="button" onclick="document.getElementById('admin-edit-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">痍⑥냼</button>
                            <button type="submit" class="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">蹂寃쎌궗?????/button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    renderAdminHistory(container, selectedWeek = null) {
        if (this.state.currentUser.role !== 'admin') return;
        
        const allSettlements = db.getAllSettlements();
        if (allSettlements.length === 0) {
            container.innerHTML = `
                <div class="glass-panel rounded-xl border border-gray-100 p-12 text-center">
                    <i data-lucide="wallet" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">怨쇨굅 ?뺤궛 ?댁뿭???놁뒿?덈떎</h3>
                    <p class="text-sm text-gray-500">?꾩쭅 留덇컧???뺤궛 湲곕줉??議댁옱?섏? ?딆뒿?덈떎.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        // Get unique weeks sorted descending
        const uniqueWeeks = [...new Set(allSettlements.map(s => s.weekName))].reverse();
        const activeWeek = selectedWeek || uniqueWeeks[0];

        // Filter settlements by selected week
        const weekSettlements = allSettlements.filter(s => s.weekName === activeWeek);
        const guilds = db.getGuilds();

        const optionsHtml = uniqueWeeks.map(w => `<option value="${w}" ${w === activeWeek ? 'selected' : ''}>${w}</option>`).join('');

        let rows = weekSettlements.map(s => {
            const guildName = guilds.find(g => g.id === s.guildId)?.name || '?????놁쓬';
            const gmName = guilds.find(g => g.id === s.guildId)?.gmName || '?????놁쓬';
            
            const btnClass = s.isPaid 
                ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' 
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200';
            const icon = s.isPaid ? 'check-circle-2' : 'clock';
            const btnText = s.isPaid ? '吏湲??꾨즺?? : '吏湲??湲곗쨷';

            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-4 text-sm font-medium text-gray-900">${guildName}</td>
                    <td class="py-4 px-4 text-sm text-gray-700">${gmName}</td>
                    <td class="py-4 px-4 text-sm text-center text-gray-600">${s.memberCount}紐?/td>
                    <td class="py-4 px-4 text-sm text-center text-gray-600">${s.totalDeliveries.toLocaleString()}嫄?/td>
                    <td class="py-4 px-4 text-sm text-center font-bold text-primary-700">${s.tier}</td>
                    <td class="py-4 px-4 text-sm text-right font-black text-blue-600">${s.totalAmount.toLocaleString()}??/td>
                    <td class="py-4 px-4 text-sm text-right flex items-center justify-end space-x-2">
                        <button onclick="app.promptEditSettlement('${s.id}')" class="px-2 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center" title="?뺤궛 ?댁뿭 ?섏젙(蹂댁젙)">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="app.togglePayment('${s.id}', '${activeWeek}')" class="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center ${btnClass}">
                            <i data-lucide="${icon}" class="w-3.5 h-3.5 mr-1.5"></i>${btnText}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6 shadow-sm">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-gray-100">
                    <div class="mb-4 sm:mb-0">
                        <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                            <i data-lucide="calendar-days" class="w-5 h-5 mr-2 text-primary-600"></i> 怨쇨굅 ?뺤궛 ?댁뿭 諛?吏湲??곹깭 愿由?                        </h3>
                        <p class="text-xs text-gray-500 mt-1">?댁쟾??留덇컧??二쇱감???뺤궛 寃곌낵瑜??뺤씤?섍퀬, ?낃툑???꾨즺??湲몃뱶瑜?泥댄겕?섏꽭??</p>
                    </div>
                    <div class="w-full sm:w-auto flex flex-col sm:flex-row gap-4 items-end">
                        <button onclick="app.downloadTransferExcel('${activeWeek}')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center h-full min-h-[42px] w-full sm:w-auto justify-center">
                            <i data-lucide="download" class="w-4 h-4 mr-2"></i>?댁껜???묒? ?ㅼ슫濡쒕뱶
                        </button>
                        <div class="w-full sm:w-64">
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">議고쉶??二쇱감 ?좏깮</label>
                            <select onchange="app.renderAdminHistory(document.getElementById('app-content'), this.value)" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
                                ${optionsHtml}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 font-semibold rounded-tl-lg">湲몃뱶紐?/th>
                                <th class="py-3 px-4 font-semibold">湲몃뱶?λ챸</th>
                                <th class="py-3 px-4 font-semibold text-center">留덇컧 ?몄썝</th>
                                <th class="py-3 px-4 font-semibold text-center">珥?諛곕떖嫄댁닔</th>
                                <th class="py-3 px-4 font-semibold text-center">?ъ꽦 ?깃툒</th>
                                <th class="py-3 px-4 font-semibold text-right">理쒖쥌 ?뺤젙 吏湲됱븸</th>
                                <th class="py-3 px-4 font-semibold rounded-tr-lg text-right">愿由?/ ?곹깭 蹂寃?/th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    renderAdminApprovals(container) {
        if (this.state.currentUser.role !== 'admin') return;
        
        const pendingMembers = db.getAllPendingMembers();
        const guilds = db.getGuilds();
        
        if (pendingMembers.length === 0) {
            container.innerHTML = `
                <div class="glass-panel rounded-xl border border-gray-100 p-12 text-center">
                    <i data-lucide="user-check" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">?뱀씤 ?湲?以묒씤 湲몃뱶?먯씠 ?놁뒿?덈떎</h3>
                    <p class="text-sm text-gray-500">紐⑤뱺 湲몃뱶??媛???붿껌??泥섎━?섏뿀?듬땲??</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        let rows = pendingMembers.map(m => {
            const guildName = guilds.find(g => g.id === m.guildId)?.name || '?????놁쓬';
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-4 text-sm font-medium text-gray-900">${guildName}</td>
                    <td class="py-4 px-4 text-sm text-gray-800 font-bold">${m.name}</td>
                    <td class="py-4 px-4 text-sm text-gray-600 font-mono">${m.baeminId || '-'}</td>
                    <td class="py-4 px-4 text-sm text-gray-600 font-mono">${m.coupangPhone || '-'}</td>
                    <td class="py-4 px-4 text-sm text-gray-500 max-w-[150px] truncate" title="${m.memo || ''}">${m.memo || '-'}</td>
                    <td class="py-4 px-4 text-sm text-right">
                        <button onclick="app.approveMember('${m.id}')" class="px-3 py-1.5 rounded-md text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors mr-2">
                            ?뱀씤
                        </button>
                        <button onclick="app.rejectMember('${m.id}')" class="px-3 py-1.5 rounded-md text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                            諛섎젮
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6 shadow-sm">
                <div class="mb-6 pb-4 border-b border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                        <i data-lucide="user-plus" class="w-5 h-5 mr-2 text-primary-600"></i> ?좉퇋 湲몃뱶??媛???뱀씤 ?湲?紐⑸줉
                        <span class="ml-3 bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">${pendingMembers.length}紐??湲곗쨷</span>
                    </h3>
                    <p class="text-xs text-gray-500 mt-2">媛?湲몃뱶?μ씠 ?깅줉???좉퇋 ?몄썝???뺤씤?섍퀬 ?뱀씤??二쇱꽭?? ?뱀씤 ?꾧퉴吏???몄썝??諛??ㅼ쟻 ?⑹궛???ы븿?섏? ?딆뒿?덈떎.</p>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 font-semibold rounded-tl-lg">?뚯냽 湲몃뱶</th>
                                <th class="py-3 px-4 font-semibold">?대쫫</th>
                                <th class="py-3 px-4 font-semibold">諛곕? ID</th>
                                <th class="py-3 px-4 font-semibold">荑좏뙜 ?룹옄由?/th>
                                <th class="py-3 px-4 font-semibold">硫붾え(鍮꾧퀬)</th>
                                <th class="py-3 px-4 font-semibold rounded-tr-lg text-right">愿由??≪뀡</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    // --- Actions ---

    showSwitchModal() {
        const guilds = db.getGuilds();
        const listDiv = document.getElementById('switch-guild-list');
        listDiv.innerHTML = guilds.map(g => `
            <button onclick="app.switchToGuild('${g.id}')" class="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors flex justify-between items-center bg-white shadow-sm">
                <span class="font-bold text-gray-800">${g.name}</span>
                <span class="text-xs text-gray-500"><i data-lucide="user" class="w-3 h-3 inline"></i> ${g.gmName}</span>
            </button>
        `).join('');
        lucide.createIcons();
        document.getElementById('switch-account-modal').classList.remove('hidden');
    },

    switchToGuild(guildId) {
        const guild = db.getGuildById(guildId);
        if(!guild) return;
        
        const user = { role: 'gm', id: guild.id, guild: guild, impersonatedByAdmin: true };
        this.state.currentUser = user;
        sessionStorage.setItem('guildSysSession', JSON.stringify(user));
        
        document.getElementById('switch-account-modal').classList.add('hidden');
        this.updateUserUI();
        this.navigate('dashboard-gm');
    },

    returnToAdmin() {
        const user = { role: 'admin', id: 'admin' };
        this.state.currentUser = user;
        sessionStorage.setItem('guildSysSession', JSON.stringify(user));
        
        this.updateUserUI();
        this.navigate('admin-overview');
    },

    togglePayment(settlementId, activeWeek) {
        db.toggleSettlementStatus(settlementId);
        this.renderAdminHistory(document.getElementById('app-content'), activeWeek);
    },

    approveMember(id) {
        try {
            // 釉뚮씪?곗? ?앹뾽 李⑤떒 臾몄젣 ?고쉶
            db.updateMemberStatus(id, 'approved');
            app.renderAdminApprovals(document.getElementById('app-content'));
        } catch(e) {
            console.error(e);
        }
    },

    rejectMember(id) {
        try {
            // 釉뚮씪?곗? ?앹뾽 李⑤떒 臾몄젣 ?고쉶
            db.updateMemberStatus(id, 'rejected');
            app.renderAdminApprovals(document.getElementById('app-content'));
        } catch(e) {
            console.error(e);
        }
    },

    promptEditAccount(guildId, currentUsername, currentPassword, currentBank, currentAccount) {
        document.getElementById('edit-g-id').value = guildId;
        document.getElementById('edit-g-id-input').value = currentUsername;
        document.getElementById('edit-g-pw-input').value = currentPassword;
        document.getElementById('edit-g-bankname-input').value = currentBank || '';
        document.getElementById('edit-g-account-input').value = currentAccount || '';
        document.getElementById('admin-edit-modal').classList.remove('hidden');
    },

    updateAccount(e) {
        e.preventDefault();
        const guildId = document.getElementById('edit-g-id').value;
        const newId = document.getElementById('edit-g-id-input').value.trim();
        const newPw = document.getElementById('edit-g-pw-input').value.trim();
        const newBank = document.getElementById('edit-g-bankname-input').value.trim();
        const newAcc = document.getElementById('edit-g-account-input').value.trim();

        if (newId === '') {
            alert('?꾩씠?붾? ?낅젰?댁＜?몄슂.');
            return;
        }

        db.updateGuild(guildId, newId, newPw, newBank, newAcc);
        document.getElementById('admin-edit-modal').classList.add('hidden');
        this.renderAdmin(document.getElementById('app-content'));
        alert('怨꾩젙 諛?怨꾩쥖 ?뺣낫媛 ?깃났?곸쑝濡?蹂寃쎈릺?덉뒿?덈떎.');
    },

    addGuild(e) {
        e.preventDefault();
        const name = document.getElementById('g-name').value;
        const gmName = document.getElementById('g-gmname').value;
        const bankName = document.getElementById('g-bankname').value.trim();
        const accountNumber = document.getElementById('g-account').value.trim();
        
        db.createGuild(name, gmName, bankName, accountNumber);
        document.getElementById('admin-add-modal').classList.add('hidden');
        this.renderAdmin(document.getElementById('app-content'));
    },

    saveNotice() {
        const text = document.getElementById('admin-notice-input').value;
        db.updateNotice(text);
        alert('怨듭??ы빆???낅뜲?댄듃 ?섏뿀?듬땲?? 湲몃뱶????쒕낫???곷떒??利됱떆 ?몄텧?⑸땲??');
    },

    promptEditSettlement(settlementId) {
        try {
            const data = db.getData();
            const s = data.settlements.find(x => x.id === settlementId);
            if(!s) return;
            
            const countStr = prompt(`[${s.weekName}] 理쒖쥌 ?몄젙 嫄댁닔瑜??낅젰?섏꽭?? (湲곗〈: ${s.totalDeliveries}嫄?`, s.totalDeliveries);
            if(countStr === null) return;
            
            const amtStr = prompt(`[${s.weekName}] 理쒖쥌 ?뺤젙 吏湲됱븸???낅젰?섏꽭?? (湲곗〈: ${s.totalAmount}??`, s.totalAmount);
            if(amtStr === null) return;

            const newCount = parseInt(countStr.replace(/,/g, ''), 10);
            const newAmt = parseInt(amtStr.replace(/,/g, ''), 10);

            if(isNaN(newCount) || isNaN(newAmt)) {
                alert('?щ컮瑜??レ옄瑜??낅젰?댁＜?몄슂.');
                return;
            }

            db.updateSettlementManual(settlementId, newCount, newAmt);
            alert('怨쇨굅 ?뺤궛 ?댁뿭??媛뺤젣 蹂댁젙?섏뿀?듬땲??');
            this.renderAdminHistory(document.getElementById('app-content'), s.weekName);
        } catch(e) {
            console.error(e);
        }
    },

    downloadTransferExcel(weekName) {
        const settlements = db.getAllSettlements().filter(s => s.weekName === weekName);
        if(settlements.length === 0) {
            alert('?대떦 二쇱감???ㅼ슫濡쒕뱶???곗씠?곌? ?놁뒿?덈떎.');
            return;
        }

        const guilds = db.getGuilds();
        
        // CSV Header
        let csvContent = "\\uFEFF"; // BOM for excel encoding
        csvContent += "??됰챸,怨꾩쥖踰덊샇,?덇툑二?湲몃뱶?λ챸),?뚯냽湲몃뱶,?댁껜湲덉븸(??,鍮꾧퀬(二쇱감)\\n";

        settlements.forEach(s => {
            const g = guilds.find(x => x.id === s.guildId);
            if(g) {
                // Remove commas from strings to not break CSV
                const bank = (g.bankName || '??됰??낅젰').replace(/,/g, '');
                const acc = (g.accountNumber || '怨꾩쥖誘몄엯??).replace(/,/g, '').replace(/-/g, '');
                const name = g.gmName.replace(/,/g, '');
                const guildName = g.name.replace(/,/g, '');
                const amt = s.totalAmount;
                const week = s.weekName.replace(/,/g, '');
                
                csvContent += `${bank},${acc},${name},${guildName},${amt},${week}\\n`;
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `?댁껜?묒떇_${weekName.replace(/\\s/g,'_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    addMember(e) {
        e.preventDefault();
        const guildId = this.state.currentUser.id;
        const name = document.getElementById('m-name').value;
        const baeminId = document.getElementById('m-baemin').value.trim();
        const coupangPhone = document.getElementById('m-coupang').value.trim();
        const memo = document.getElementById('m-memo').value.trim();

        if (!baeminId && !coupangPhone) {
            alert('諛곕? 而ㅻ꽖??ID ?먮뒗 荑좏뙜?댁툩 ?룹옄由?以?理쒖냼 ?섎굹???낅젰?댁빞 ?ㅼ쟻 留ㅼ묶??媛?ν빀?덈떎.');
        }

        db.addMember(guildId, { name, baeminId, coupangPhone, memo });
        document.getElementById('add-modal').classList.add('hidden');
        this.renderMembers(document.getElementById('app-content'));
    },

    deleteMember(id) {
        try {
            // 釉뚮씪?곗? ?앹뾽(confirm)??李⑤떒??寃쎌슦瑜??鍮꾪븯???앹뾽 ?놁씠 利됱떆 ??젣?섎룄濡??꾩떆 ?고쉶
            db.deleteMember(id);
            app.renderMembers(document.getElementById('app-content'));
        } catch(e) {
            console.error('??젣 以??ㅻ쪟 諛쒖깮: ', e);
        }
    },

    async processUpload(platform) {
        const fileInput = document.getElementById(`file-${platform}`);
        if (!fileInput.files.length) {
            alert('?낅줈?쒗븷 ?뚯씪???섎굹 ?댁긽 ?좏깮?댁＜?몄슂.');
            return;
        }

        const files = Array.from(fileInput.files);
        
        // ADMIN UPLOAD: Fetch ALL members across ALL guilds for global matching
        const allActiveMembers = db.getMembers(); 
        
        const resultBox = document.getElementById('upload-result');
        resultBox.classList.remove('hidden');
        resultBox.innerHTML = `
            <div class="p-6 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                <i data-lucide="loader-2" class="w-5 h-5 animate-spin mr-2"></i> ${files.length}媛??뚯씪 ?꾩껜 留덉뒪??DB ?뚯떛 以?..
            </div>
        `;
        lucide.createIcons();

        try {
            const result = await ExcelParser.parseMultipleFiles(files, platform, allActiveMembers);
            
            for (const [memberId, count] of Object.entries(result.memberDeliveries)) {
                db.addDeliveriesToMember(memberId, count);
            }

            let unmatchedHtml = '';
            if (result.unmatchedCount > 0) {
                unmatchedHtml = `
                    <div class="mt-4 p-4 bg-red-50 border border-red-100 rounded-md">
                        <p class="text-sm font-medium text-red-800 mb-2"><i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i>留ㅼ묶 ?ㅽ뙣 ?곗씠??(${result.unmatchedCount}嫄?</p>
                        <p class="text-xs text-red-600 mb-2">?대뒓 湲몃뱶?먮룄 ?랁븯吏 ?딆? ?좊졊 ?곗씠?곗엯?덈떎. ?꾨씫???덈떎硫?湲몃뱶?μ뿉寃??깅줉??吏?쒗븯?몄슂.</p>
                        <ul class="text-xs text-gray-700 list-disc pl-5">
                            ${result.unmatchedSamples.map(u => `<li>${u.name || '?대쫫?놁쓬'} (?앸퀎?? ${u.identifier})</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            resultBox.innerHTML = `
                <div class="glass-panel p-6 rounded-xl border-l-4 border-l-green-500 shadow-sm">
                    <div class="flex items-center text-green-700 mb-4">
                        <i data-lucide="check-circle-2" class="w-6 h-6 mr-2"></i>
                        <h4 class="text-lg font-bold">?꾩껜 ?먮룞 ?꾩쟻 ?꾨즺</h4>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="bg-gray-50 p-3 rounded">
                            <span class="text-gray-500 block mb-1">珥??ㅼ틪???묒? ??Row)</span>
                            <span class="font-bold text-gray-900 text-lg">${result.totalRowsProcessed}嫄?/span>
                        </div>
                        <div class="bg-blue-50 p-3 rounded">
                            <span class="text-blue-600 block mb-1">湲몃뱶?먮퀎 留ㅼ묶 ?깃났</span>
                            <span class="font-bold text-blue-900 text-lg">+${result.matchedDeliveries}嫄?湲곗〈 ?곗씠?곗뿉 ?꾩쟻??/span>
                        </div>
                    </div>
                    ${unmatchedHtml}
                    <div class="mt-6 flex justify-end">
                        <button onclick="app.navigate('admin-overview')" class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700">?꾩껜 湲몃뱶 ?꾪솴 蹂닿린</button>
                    </div>
                </div>
            `;
            lucide.createIcons();
            
        } catch (error) {
            resultBox.innerHTML = `
                <div class="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    <div class="font-bold mb-2">?ㅻ쪟 諛쒖깮</div>
                    <div class="text-sm">${error.message || '?뚯씪???쎌쓣 ???놁뒿?덈떎. ?묒떇???뺤씤?댁＜?몄슂.'}</div>
                </div>
            `;
        }
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    window.app = app; // Make globally explicitly available
    window.db = db;
    app.init();
});
