const app = {
    state: {
        currentUser: null, // { role: 'admin'|'gm', id: string, guild?: object }
        currentView: 'dashboard-gm',
        sidebarOpen: false
    },

    async init() {
        // 서버에서 데이터 불러오기 대기 (길드 + 소득신고 동시 로드)
        await Promise.all([
            db.loadFromServer(),
            incomeDb.loadFromServer()
        ]);

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

        // Initialize icons
        lucide.createIcons();
    },

    toggleSidebar() {
        this.state.sidebarOpen = !this.state.sidebarOpen;
        const sidebar = document.getElementById('main-sidebar');
        const backdrop = document.getElementById('mobile-sidebar-backdrop');
        
        if (this.state.sidebarOpen) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
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
                alert(`시간이 지나 정산 주기가 변경되었습니다.\n지난 주차(${finalizedOldWeek})가 자동으로 마감 및 저장되었습니다.`);
            }

            this.updateUserUI();
            
            // Navigate based on role
            this.navigate(user.role === 'admin' ? 'admin-overview' : 'dashboard-gm');
        } else {
            errorDiv.innerText = '아이디 또는 비밀번호가 일치하지 않습니다.';
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
            
        document.getElementById('current-user-name').innerText = !isAdmin ? guild.gmName : '최고 관리자';
        document.getElementById('current-user-role').innerText = !isAdmin ? guild.name : 'System Admin';

        // Toggle nav items based on role
        document.getElementById('nav-dashboard-gm').style.display = !isAdmin ? 'flex' : 'none';
        document.getElementById('nav-members').style.display = !isAdmin ? 'flex' : 'none';
        document.getElementById('nav-history').style.display = !isAdmin ? 'flex' : 'none'; // GM Only
        document.getElementById('nav-upload').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN
        document.getElementById('nav-upload-history').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN
        document.getElementById('nav-admin-overview').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('nav-admin-history').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN
        document.getElementById('nav-admin-history-log').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN
        document.getElementById('nav-admin-approvals').style.display = isAdmin ? 'flex' : 'none'; // ONLY ADMIN

        // 소득신고 관리 - Admin 전용
        document.getElementById('nav-income-manager').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('nav-income-section').style.display = isAdmin ? 'block' : 'none';

        // 이벤트/추첨 관리 - Admin 전용
        document.getElementById('nav-admin-events').style.display = isAdmin ? 'flex' : 'none';

        // Switch Account Buttons
        document.getElementById('btn-switch-account').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('btn-return-admin').style.display = isImpersonating ? 'flex' : 'none';
    },

    navigate(view) {
        this.state.currentView = view;
        
        // Close sidebar on mobile
        const sidebar = document.getElementById('main-sidebar');
        const backdrop = document.getElementById('mobile-sidebar-backdrop');
        if (this.state.sidebarOpen) {
            this.state.sidebarOpen = false;
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('nav-active'));
        const activeNav = document.getElementById(`nav-${view}`);
        if(activeNav) activeNav.classList.add('nav-active');

        const contentArea = document.getElementById('app-content');
        const titleArea = document.getElementById('page-title');
        const currentWeekName = db.getCurrentWeekName();

        switch(view) {
            case 'dashboard-gm':
                titleArea.innerText = `이번 주 대시보드 (${currentWeekName})`;
                this.renderDashboard(contentArea);
                break;
            case 'members':
                titleArea.innerText = `소속 길드원 관리 (${currentWeekName})`;
                this.renderMembers(contentArea);
                break;
            case 'history':
                titleArea.innerText = '과거 정산 내역';
                this.renderHistory(contentArea);
                break;
            case 'upload':
                titleArea.innerText = '전체 길드 정산서 업로드 (Admin)';
                this.renderUpload(contentArea);
                break;
            case 'upload-history':
                titleArea.innerText = '엑셀 업로드 이력 관리 (Admin)';
                this.renderUploadHistory(contentArea);
                break;
            case 'admin-overview':
                titleArea.innerText = `전체 길드 통합 현황 (${currentWeekName})`;
                this.renderAdmin(contentArea);
                break;
            case 'admin-history':
                titleArea.innerText = '과거 정산 및 지급 관리 (Admin)';
                this.renderAdminHistory(contentArea);
                break;
            case 'admin-approvals':
                titleArea.innerText = '신규 길드원 가입 승인 (Admin)';
                this.renderAdminApprovals(contentArea);
                break;
            case 'admin-history-log':
                titleArea.innerText = '전체 시스템 등록 현황 및 이력 (Admin)';
                this.renderRegistrationHistory(contentArea);
                break;
            case 'admin-events':
                titleArea.innerText = '이벤트 / 추첨 관리 (Admin)';
                eventDb.load().then(() => eventApp.render(contentArea));
                break;
            case 'income-manager':
                titleArea.innerText = '라이더 소득신고 정산 관리';
                // 탭 진입 시마다 최신 데이터를 클라우드에서 로드 후 렌더링
                contentArea.innerHTML = '<div class="p-10 text-center text-gray-400"><div class="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>클라우드에서 데이터 불러오는 중...</div>';
                incomeDb.loadFromServer().then(() => {
                    incomeDb._loadingPromise = null; // 다음 진입을 위해 리셋
                    incomeApp.render(contentArea);
                });
                break;
        }
    },

    // --- Views ---

    renderDashboard(container) {
        if (this.state.currentUser.role === 'admin') return;

        const guildId = this.state.currentUser.id;
        const guild = db.getGuildById(guildId);
        const activeCount = db.getHeadcountForGuild(guildId);
        const totalDeliveries = db.getTotalDeliveriesForGuild(guildId);
        
        const result = SettlementEngine.calculateSettlement(activeCount, totalDeliveries, guild?.customTiers, guild?.customRule);

        const globalNotice = db.getNotice();
        const noticeHtml = globalNotice ? `
            <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded shadow-sm flex items-start">
                <i data-lucide="bell-ring" class="w-5 h-5 text-red-500 mr-3 mt-0.5"></i>
                <div>
                    <h4 class="text-sm font-bold text-red-800 mb-1">본사 긴급 공지사항</h4>
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
                            <p class="text-xs text-gray-500">${m.baeminId || 'ID없음'}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold text-gray-900">${(m.deliveries || 0).toLocaleString()}건</p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            ${noticeHtml}
            <div class="flex justify-between items-center mb-6">
                <div id="upgrade-area"></div>
                <button onclick="app.resetGuild('${guildId}')" class="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center">
                    <i data-lucide="rotate-ccw" class="w-4 h-4 mr-2"></i> 개별 수동 마감 (초기화)
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                <div class="glass-panel p-5 md:p-6 rounded-xl border border-gray-100">
                    <div class="flex items-center text-gray-500 mb-2">
                        <i data-lucide="users" class="w-4 h-4 md:w-5 md:h-5 mr-2 text-blue-500"></i>
                        <span class="font-bold text-xs md:text-sm">현재 소속 인원</span>
                    </div>
                    <div class="text-2xl md:text-3xl font-black text-gray-900">${activeCount}<span class="text-sm font-normal text-gray-500 ml-1">명</span></div>
                </div>

                <div class="glass-panel p-5 md:p-6 rounded-xl border border-gray-100">
                    <div class="flex items-center text-gray-500 mb-2">
                        <i data-lucide="bike" class="w-4 h-4 md:w-5 md:h-5 mr-2 text-orange-500"></i>
                        <span class="font-bold text-xs md:text-sm">주간 누적 배달건수</span>
                    </div>
                    <div class="text-2xl md:text-3xl font-black text-gray-900">${totalDeliveries.toLocaleString()}<span class="text-sm font-normal text-gray-500 ml-1">건</span></div>
                </div>

                <div class="glass-panel p-5 md:p-6 rounded-xl border border-gray-100">
                    <div class="flex items-center text-gray-500 mb-2">
                        <i data-lucide="calculator" class="w-4 h-4 md:w-5 md:h-5 mr-2 text-purple-500"></i>
                        <span class="font-bold text-xs md:text-sm">주간 예상 정산금액</span>
                    </div>
                    <div class="text-2xl md:text-3xl font-black text-gray-900">${result.totalAmount.toLocaleString()}<span class="text-sm font-normal text-gray-500 ml-1">원</span></div>
                    <div class="text-xs text-gray-500 mt-2 font-medium bg-gray-50 p-2 rounded">${result.message}</div>
                </div>
            </div>`;

        // Monthly Incentive Display
        const incData = db.getMonthlyIncentiveData(guildId);
        if (incData) {
            const currentMonthStr = incData.month.split('-')[1] + '월';
            container.innerHTML += `
            <div class="glass-panel rounded-xl border border-emerald-100 p-5 md:p-6 mb-8 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                <h3 class="text-lg font-bold text-emerald-800 mb-4 flex items-center">
                    <i data-lucide="target" class="w-5 h-5 mr-2 text-emerald-500"></i> ${currentMonthStr} 월간 팀장 인센티브 예상 현황
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-white p-3 rounded-lg border border-emerald-50">
                        <p class="text-xs font-bold text-gray-500 mb-1">월간 누적 총 콜수</p>
                        <p class="text-lg font-black text-gray-800">${incData.monthlyTotal.toLocaleString()}건</p>
                    </div>
                    <div class="bg-white p-3 rounded-lg border border-emerald-50">
                        <p class="text-xs font-bold text-gray-500 mb-1">등록 인원수</p>
                        <p class="text-lg font-black text-gray-800">${incData.activeCount}명</p>
                    </div>
                    <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                        <p class="text-xs font-bold text-emerald-800 mb-1">인원당 월평균 콜수</p>
                        <p class="text-xl font-black text-emerald-600">${incData.monthlyAverage.toLocaleString()}건</p>
                    </div>
                    <div class="bg-emerald-500 p-3 rounded-lg shadow text-white flex flex-col justify-center">
                        <p class="text-xs font-bold text-emerald-100 mb-1">예상 인센티브(총액)</p>
                        <p class="text-xl font-black">${incData.expectedTotal.toLocaleString()}원</p>
                        <p class="text-[10px] text-emerald-200 mt-1">인당 ${incData.expectedAmountPerPerson.toLocaleString()}원 적용</p>
                    </div>
                </div>
            </div>`;
        }

        container.innerHTML += `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div class="lg:col-span-2 glass-panel rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col h-full">
                    <h3 class="text-lg font-semibold mb-4 text-gray-800 border-b pb-2 flex items-center">
                        <i data-lucide="trending-up" class="w-5 h-5 mr-2 text-primary-600"></i> 최근 4주간 실적 추이
                    </h3>
                    <div class="flex-grow w-full relative min-h-[250px]">
                        <canvas id="dashboardChart"></canvas>
                    </div>
                </div>
                
                <div class="glass-panel rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col h-full">
                    <h3 class="text-lg font-semibold mb-4 text-gray-800 border-b pb-2 flex items-center">
                        <i data-lucide="crown" class="w-5 h-5 mr-2 text-yellow-500"></i> 이번 주 명예의 전당 (TOP 3)
                    </h3>
                    <div class="flex-grow flex flex-col justify-center">
                        ${sortedMembers.length > 0 ? top3Html : '<p class="text-center text-sm text-gray-500 py-4">아직 실적이 등록된 길드원이 없습니다.</p>'}
                    </div>
                </div>
            </div>

            <div class="glass-panel rounded-xl border border-gray-100 p-8 shadow-sm">
                <h3 class="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">예상 정산 결과 (화요일 마감 기준)</h3>
                <div class="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-600">인정 배달 건수 (Limit Cap 적용)</span>
                        <span class="font-semibold text-gray-900">${result.recognizedDeliveries.toLocaleString()} 건</span>
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-600">적용 단가 (1,000건당)</span>
                        <span class="font-semibold text-gray-900">${result.pricePer1000 ? result.pricePer1000.toLocaleString() : 0} 원</span>
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-600">정산 블록수</span>
                        <span class="font-semibold text-gray-900">${result.chunks} 묶음</span>
                    </div>
                    <hr class="my-4 border-gray-200">
                    <div class="flex justify-between items-center text-xl">
                        <span class="font-bold text-gray-800">예상 지급액</span>
                        <span class="font-bold text-primary-600">${result.totalAmount.toLocaleString()} 원</span>
                    </div>
                    ${result.message.includes('미달') ? `<p class="text-sm text-red-500 mt-4 font-medium">${result.message}</p>` : ''}
                </div>
            </div>
        `;
        lucide.createIcons();
        
        // Render Chart.js
        setTimeout(() => this.renderChart(guildId), 50);

        this.checkUpgradeEligibility(guildId, activeCount, totalDeliveries);
    },

    checkUpgradeEligibility(guildId, count, deliveries) {
        const guild = db.getGuildById(guildId);

        // 단일단가제 또는 팀장 인센티브 설정 길드는 일반 등급 승급 시스템을 사용하지 않음
        const hasCustomRule = guild.customRule && guild.customRule.targetCalls > 0;
        const hasCustomInc = guild.customIncentives && guild.customIncentives.length > 0;
        if (hasCustomRule || hasCustomInc) {
            // 혹시 이전에 렌더된 배너 잔재가 있을 경우 제거
            const upgradeArea = document.getElementById('upgrade-area');
            if (upgradeArea) upgradeArea.innerHTML = '';
            return;
        }

        // 기본 등급은 브론즈(Bronze)부터 시작
        const currentTier = (guild.tier === 'None' || !guild.tier) ? 'Bronze' : guild.tier;
        let nextTier = null;

        // 승급 기준 (현재 등급의 Max 인원 달성 & 목표 콜수 달성 시 승급 요청 가능)
        // 브론즈 -> 실버: 인원 10명 이상 & 주간 3000건 이상
        if (currentTier === 'Bronze' && count >= 10 && deliveries >= 3000) nextTier = 'Silver';
        // 실버 -> 골드: 인원 15명 이상 & 주간 4000건 이상
        if (currentTier === 'Silver' && count >= 15 && deliveries >= 4000) nextTier = 'Gold';

        if (nextTier) {
            const upgradeArea = document.getElementById('upgrade-area');
            const requests = db.getUpgradeRequests() || [];
            const pendingReq = requests.find(r => r.guildId === guildId && r.status === 'pending');

            if (pendingReq) {
                upgradeArea.innerHTML = `
                    <div class="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
                        <div class="flex items-center">
                            <i data-lucide="clock" class="w-5 h-5 text-blue-500 mr-3"></i>
                            <span class="text-sm font-bold text-blue-800">${nextTier} 등급 승급 심사 중입니다.</span>
                        </div>
                    </div>
                `;
            } else {
                upgradeArea.innerHTML = `
                    <div class="bg-gradient-to-r from-primary-600 to-primary-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between shadow-lg">
                        <div class="flex items-center mb-3 md:mb-0">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
                                <i data-lucide="trending-up" class="w-6 h-6 text-white"></i>
                            </div>
                            <div class="text-white">
                                <h4 class="font-bold text-sm">축하합니다! ${nextTier} 등급 승급 조건 달성</h4>
                                <p class="text-xs opacity-90">상위 등급으로 승급하면 더 많은 길드원을 영입할 수 있습니다.</p>
                            </div>
                        </div>
                        <button onclick="app.handleUpgradeRequest('${guildId}', '${currentTier}', '${nextTier}')" class="w-full md:w-auto px-6 py-2 bg-white text-primary-700 rounded-lg font-black text-sm hover:bg-primary-50 transition-colors shadow-sm">
                            승급 신청하기
                        </button>
                    </div>
                `;
            }
            lucide.createIcons();
        }
    },

    handleUpgradeRequest(guildId, current, next) {
        if (confirm(`${next} 등급으로 승급을 신청하시겠습니까?`)) {
            try {
                db.requestTierUpgrade(guildId, current, next);
                alert('승급 신청이 완료되었습니다. 본사 승인 후 반영됩니다.');
                this.navigate('dashboard-gm');
            } catch (e) {
                alert(e.message);
            }
        }
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
            labels = recentSettlements.map(s => s.weekName.replace('년 ', '\n').replace('월 ', '/').replace('주차', '주'));
            dataPoints = recentSettlements.map(s => s.totalDeliveries);
        }

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '주간 총 배달 건수',
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
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">과거 정산 내역이 없습니다</h3>
                    <p class="text-sm text-gray-500">아직 수요일이 되어 자동 마감된 정산 기록이 존재하지 않습니다.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        let historyRows = settlements.map(s => `
            <div class="glass-panel p-6 rounded-xl border border-gray-100 mb-4 hover:border-blue-300 transition-colors relative">
                ${s.isPaid ? 
                    '<div class="absolute top-4 right-6 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full border border-green-200 shadow-sm"><i data-lucide="check-circle-2" class="w-3 h-3 inline mr-1"></i>본사 지급 완료</div>' : 
                    '<div class="absolute top-4 right-6 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full border border-orange-200 shadow-sm"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>지급 대기 중</div>'}
                <div class="flex justify-between items-center border-b border-gray-100 pb-3 mb-4 mt-2">
                    <h4 class="text-lg font-bold text-gray-900">${s.weekName}</h4>
                    <span class="text-sm text-gray-500">마감 승인일: ${s.date}</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p class="text-xs text-gray-500 mb-1">달성 등급</p>
                        <p class="font-bold text-primary-700">${s.tier}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 mb-1">마감 인원</p>
                        <p class="font-bold text-gray-800">${s.memberCount}명</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 mb-1">총 배달건수 (인정건수)</p>
                        <p class="font-bold text-gray-800">${s.totalDeliveries.toLocaleString()}건 <span class="text-xs font-normal text-gray-400">(${s.recognizedDeliveries.toLocaleString()}건 인정)</span></p>
                    </div>
                    <div class="text-right border-l pl-4 border-gray-100">
                        <p class="text-xs text-gray-500 mb-1">최종 지급 확정액</p>
                        <p class="text-xl font-black text-blue-600">${s.totalAmount.toLocaleString()}원</p>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-6 flex items-center">
                    <i data-lucide="calendar-check" class="w-6 h-6 mr-2 text-primary-600"></i> 매주 수요일 자동 마감된 정산 기록
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
            if(status === 'pending') return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">승인 대기중</span>';
            if(status === 'rejected') return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 ml-2">반려됨</span>';
            return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 ml-2">승인 완료</span>';
        };

        let rows = members.map(m => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 px-4 text-sm text-gray-700 font-semibold">
                    ${m.name}
                    ${getStatusBadge(m.status)}
                    ${m.memo ? `<br><span class="text-xs text-gray-400 font-normal truncate max-w-[100px] inline-block" title="${m.memo}">📝 ${m.memo}</span>` : ''}
                </td>
                <td class="py-3 px-4 text-sm text-gray-700 font-mono">${m.baeminId || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-700 font-mono">${m.coupangPhone || '-'}</td>
                <td class="py-3 px-4 text-sm font-bold text-blue-600">${(m.deliveries || 0).toLocaleString()}건</td>
                <td class="py-3 px-4 text-sm text-right">
                    <div class="flex items-center justify-end space-x-2">
                        <button type="button" onclick="app.showEditMemberModal('${m.id}')" class="text-blue-500 hover:text-blue-700 text-xs font-semibold px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors">수정</button>
                        <button type="button" onclick="app.deleteMember('${m.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">삭제</button>
                    </div>
                </td>
            </tr>
        `).join('');

        const guild = db.getGuildById(guildId);
        const hasCustomRule = guild && guild.customRule && guild.customRule.targetCalls > 0;
        const hasCustomInc = guild && guild.customIncentives && guild.customIncentives.length > 0;
        const isCustomLimit = hasCustomRule || hasCustomInc;

        const tierBadgeHtml = isCustomLimit 
            ? `<span class="ml-3 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full border border-indigo-200">단일/인센티브 적용</span>`
            : `<span id="display-tier-badge" class="ml-3 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full border border-primary-200">${db.getEffectiveTier(guildId)} 등급</span>`;
        
        const tierDescHtml = isCustomLimit
            ? `<p class="text-xs text-gray-500 mt-1 italic">현재 인원: ${members.length}명 / 인원 제한 없음</p>`
            : `<p class="text-xs text-gray-500 mt-1 italic">현재 인원: ${members.length}명 / 등급별 자동 조건 적용됨</p>`;

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div>
                        <h4 class="text-xs font-bold text-primary-600 uppercase tracking-widest mb-1">Guild Status</h4>
                        <h3 class="text-xl font-bold text-gray-800 flex items-center">
                            <i data-lucide="users" class="w-6 h-6 mr-2 text-primary-600"></i> 이번 주 소속 길드원 관리 
                            ${tierBadgeHtml}
                        </h3>
                        ${tierDescHtml}
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" onclick="app.downloadMemberTemplate()" class="inline-flex items-center justify-center px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all border border-gray-200">
                            <i data-lucide="download" class="w-4 h-4 mr-1.5"></i> 양식 다운로드
                        </button>
                        <button type="button" onclick="app.showBulkUploadModal()" class="inline-flex items-center justify-center px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all shadow-md">
                            <i data-lucide="upload" class="w-4 h-4 mr-1.5"></i> 엑셀 일괄 등록
                        </button>
                        <button type="button" onclick="app.showAddMemberModal()" class="inline-flex items-center justify-center px-4 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg hover:shadow-primary-200 active:scale-95">
                            <i data-lucide="plus" class="w-4 h-4 mr-1.5"></i> 직접 추가
                        </button>
                    </div>
                </div>

                <div class="glass-panel rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div class="overflow-x-auto pb-2">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-gray-50 text-gray-500 text-[10px] md:text-xs uppercase tracking-wider border-b border-gray-200">
                                    <th class="py-3 px-4 font-bold min-w-[80px]">이름/상태</th>
                                    <th class="py-3 px-4 font-bold min-w-[100px]">배민 ID</th>
                                    <th class="py-3 px-4 font-bold min-w-[90px]">쿠팡 뒷자리</th>
                                    <th class="py-3 px-4 font-bold min-w-[100px] text-blue-700">주간 실적</th>
                                    <th class="py-3 px-4 font-bold min-w-[60px] text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${rows.length > 0 ? rows : `<tr><td colspan="5" class="text-center py-8 text-gray-400">등록된 길드원이 없습니다.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Bulk Upload Modal -->
            <div id="bulk-upload-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div class="glass-panel w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                    <div class="p-6 border-b border-gray-100">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <i data-lucide="users" class="w-5 h-5 text-green-600"></i> 길드원 엑셀 일괄 등록
                            </h3>
                            <button type="button" onclick="document.getElementById('bulk-upload-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">엑셀 양식을 다운로드한 뒤 작성하여 업로드하세요. 이름 컬럼은 필수입니다.</p>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1">
                        <!-- Upload Area -->
                        <label id="bulk-drop-zone" for="bulk-file-input" class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-green-50 hover:border-green-400 transition-colors">
                            <i data-lucide="file-spreadsheet" class="w-8 h-8 text-gray-400 mb-2"></i>
                            <span class="text-sm font-medium text-gray-600">클릭하여 파일 선택 <span class="text-gray-400 font-normal">또는 드래그 앤 드롭</span></span>
                            <span class="text-xs text-gray-400 mt-1">.xlsx / .xls / .csv 지원</span>
                            <input type="file" id="bulk-file-input" accept=".xlsx,.xls,.csv" class="hidden" onchange="app.handleBulkUploadFile(event)">
                        </label>

                        <!-- Preview -->
                        <div id="bulk-preview-area" class="hidden mt-4">
                            <div class="flex items-center justify-between mb-2">
                                <span id="bulk-preview-count" class="text-sm font-semibold text-gray-700"></span>
                                <button type="button" onclick="document.getElementById('bulk-file-input').value=''; document.getElementById('bulk-preview-area').classList.add('hidden'); document.getElementById('bulk-confirm-btn').disabled=true;" class="text-xs text-gray-500 hover:text-red-500">다시 선택</button>
                            </div>
                            <div class="rounded-xl border border-gray-200 overflow-hidden">
                                <div class="overflow-x-auto max-h-64">
                                    <table class="w-full text-left text-sm">
                                        <thead class="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                                            <tr>
                                                <th class="px-3 py-2 font-bold">#</th>
                                                <th class="px-3 py-2 font-bold">이름</th>
                                                <th class="px-3 py-2 font-bold">배민커넥트ID</th>
                                                <th class="px-3 py-2 font-bold">쿠팡뒷자리</th>
                                                <th class="px-3 py-2 font-bold">메모</th>
                                                <th class="px-3 py-2 font-bold text-center">상태</th>
                                            </tr>
                                        </thead>
                                        <tbody id="bulk-preview-tbody" class="divide-y divide-gray-100"></tbody>
                                    </table>
                                </div>
                            </div>
                            <div id="bulk-error-area" class="hidden mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"></div>
                        </div>
                    </div>

                    <div class="p-4 border-t border-gray-100 flex justify-between items-center">
                        <button type="button" onclick="app.downloadMemberTemplate()" class="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-700 font-medium">
                            <i data-lucide="download" class="w-4 h-4"></i> 양식 다운로드
                        </button>
                        <div class="flex gap-2">
                            <button type="button" onclick="document.getElementById('bulk-upload-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
                            <button type="button" id="bulk-confirm-btn" onclick="app.confirmBulkUpload()" disabled class="px-5 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                                등록 확인
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Add Member Modal -->
            <div id="add-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                <div class="glass-panel w-full max-w-md p-6 rounded-xl shadow-xl">
                    <h3 class="text-lg font-semibold mb-4 border-b pb-2">신규 길드원 등록</h3>
                    <form id="add-member-form" onsubmit="app.addMember(event)">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">이름 <span class="text-xs text-gray-500 font-normal">(타명의 사용시 쉼표로 구분. 예: 홍길동,김가족)</span></label>
                                <input type="text" id="m-name" required placeholder="홍길동" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">배민 커넥트 ID <span class="text-xs text-gray-500 font-normal">(선택, 다중 쉼표 가능)</span></label>
                                <input type="text" id="m-baemin" placeholder="hong123, kim123" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">쿠팡이츠 뒷자리 <span class="text-xs text-gray-500 font-normal">(선택, 다중 쉼표 가능)</span></label>
                                <input type="text" id="m-coupang" placeholder="1234, 5678" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">메모/비고 <span class="text-xs text-gray-500 font-normal">(선택)</span></label>
                                <input type="text" id="m-memo" placeholder="예: 김가족 명의 사용" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-yellow-50">
                            </div>
                        </div>
                        <div class="mt-6 flex justify-end space-x-3">
                            <button type="button" onclick="document.getElementById('add-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">취소</button>
                            <button type="submit" class="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700">저장</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Edit Member Modal -->
            <div id="edit-member-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
                <div class="glass-panel w-full max-w-md p-6 rounded-xl shadow-xl">
                    <h3 class="text-lg font-semibold mb-4 border-b pb-2 text-blue-800">길드원 정보 수정</h3>
                    <form id="edit-member-form" onsubmit="app.handleUpdateMember(event)">
                        <input type="hidden" id="edit-m-id">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">이름</label>
                                <input type="text" id="edit-m-name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">배민 커넥트 ID</label>
                                <input type="text" id="edit-m-baemin" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">쿠팡이츠 뒷자리</label>
                                <input type="text" id="edit-m-coupang" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">메모/비고</label>
                                <input type="text" id="edit-m-memo" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-yellow-50">
                            </div>
                        </div>
                        <div class="mt-6 flex justify-end space-x-3">
                            <button type="button" onclick="document.getElementById('edit-member-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">취소</button>
                            <button type="submit" class="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">변경사항 저장</button>
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
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8 rounded-r-lg shadow-sm">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <i data-lucide="info" class="w-5 h-5 text-blue-500"></i>
                    </div>
                    <div class="ml-3">
                        <h3 class="text-sm font-bold text-blue-800">전체 길드 일괄 합산 (Admin 전용)</h3>
                        <p class="mt-1 text-sm text-blue-700 leading-relaxed">
                            여러 엑셀 파일을 선택하여 업로드하면 <b>전체 마스터 길드원 DB</b>를 검색하여 실적이 누적 합산(+)됩니다.
                            <br><span class="text-xs opacity-75">※ 수요일에 지난주 화요일 정산서가 나올 경우, 아래 옵션에서 '지난 정산 주차'를 선택해 소급 적용할 수 있습니다.</span>
                        </p>
                    </div>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-xl border border-blue-100 mb-8 shadow-sm">
                <h4 class="text-sm font-bold text-gray-700 mb-4 flex items-center">
                    <i data-lucide="calendar" class="w-4 h-4 mr-2 text-blue-600"></i> 실적 반영 대상 주차 선택
                </h4>
                <div class="flex flex-col md:flex-row gap-6">
                    <label class="flex items-center cursor-pointer group">
                        <input type="radio" name="target-period" value="current" checked class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" onchange="document.getElementById('past-settlement-select').disabled = true">
                        <span class="ml-2 text-sm font-medium text-gray-700 group-hover:text-blue-600">현재 진행 중인 주차 (${db.getCurrentWeekName()})</span>
                    </label>
                    <label class="flex items-center cursor-pointer group">
                        <input type="radio" name="target-period" value="past" class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" onchange="document.getElementById('past-settlement-select').disabled = false">
                        <span class="ml-2 text-sm font-medium text-gray-700 group-hover:text-blue-600">이미 마감된 정산 주차 소급 적용</span>
                        <select id="past-settlement-select" disabled class="ml-3 px-3 py-1 border border-gray-300 rounded text-xs focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400">
                            ${[...new Set(db.getAllSettlements().map(s => s.weekName))].reverse().map(w => `<option value="${w}">${w}</option>`).join('')}
                        </select>
                    </label>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <!-- Baemin Upload -->
                <div class="glass-panel p-6 rounded-2xl border border-gray-100 shadow-lg relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
                    <div class="flex items-center mb-6">
                        <div class="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center mr-3">
                            <i data-lucide="bike" class="w-5 h-5 text-teal-600"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-800">배민 엑셀 업로드</h3>
                    </div>
                    <input type="file" id="file-baemin" multiple accept=".xlsx, .xls"
                        class="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 mb-2 cursor-pointer"
                        onchange="app._detectAndApplyWeek(this)">
                    <p id="week-hint-baemin" class="text-xs text-teal-600 font-bold mb-3 hidden"></p>
                    <button onclick="app.processUpload('baemin')" class="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center justify-center">
                        <i data-lucide="zap" class="w-4 h-4 mr-2"></i> 파일 일괄 파싱 및 누적
                    </button>
                </div>

                <!-- Coupang Upload -->
                <div class="glass-panel p-6 rounded-2xl border border-gray-100 shadow-lg relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                    <div class="flex items-center mb-6">
                        <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mr-3">
                            <i data-lucide="truck" class="w-5 h-5 text-red-600"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-800">쿠팡 엑셀 업로드</h3>
                    </div>
                    <input type="file" id="file-coupang" multiple accept=".xlsx, .xls"
                        class="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 mb-2 cursor-pointer"
                        onchange="app._detectAndApplyWeek(this)">
                    <p id="week-hint-coupang" class="text-xs text-red-600 font-bold mb-3 hidden"></p>
                    <button onclick="app.processUpload('coupang')" class="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center justify-center">
                        <i data-lucide="zap" class="w-4 h-4 mr-2"></i> 파일 일괄 파싱 및 누적
                    </button>
                </div>
            </div>

            <div id="upload-result" class="hidden"></div>
        `;
        lucide.createIcons();
    },

    renderUploadHistory(container) {
        if (this.state.currentUser.role !== 'admin') return;

        const uploadHistory = db.getUploadHistory().slice().reverse(); // 최신순
        const allSettlements = db.getAllSettlements();
        const guilds = db.getGuilds();

        const pbadge = p => p === 'baemin'
            ? '<span class="inline-block px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-800">배민</span>'
            : '<span class="inline-block px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">쿠팡</span>';

        // 추적된 업로드가 있는 weekName 집합
        const trackedWeekNames = new Set(uploadHistory.map(r => r.weekName));

        // 이력 없이 배달 건수가 있는 정산 → 주차별 집계 (미추적)
        const untrackedMap = {};
        allSettlements.forEach(s => {
            if (s.totalDeliveries > 0 && !trackedWeekNames.has(s.weekName)) {
                if (!untrackedMap[s.weekName]) untrackedMap[s.weekName] = { total: 0, guildNames: [] };
                const guild = guilds.find(g => g.id === s.guildId);
                untrackedMap[s.weekName].total += s.totalDeliveries;
                untrackedMap[s.weekName].guildNames.push(guild ? guild.name : s.guildId);
            }
        });
        const untrackedEntries = Object.entries(untrackedMap).sort((a, b) => b[0].localeCompare(a[0]));

        const hasAnything = uploadHistory.length > 0 || untrackedEntries.length > 0;

        if (!hasAnything) {
            container.innerHTML = `
                <div class="text-center py-14 text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    <i data-lucide="file-x" class="w-10 h-10 mx-auto mb-3 opacity-40"></i>
                    <p class="text-sm font-medium">업로드 이력이 없습니다.</p>
                    <p class="text-xs mt-1">엑셀 정산 업로드 메뉴에서 파일을 업로드하면 여기에 기록됩니다.</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        // 추적된 업로드 행
        const trackedRows = uploadHistory.map(r => {
            const dt = new Date(r.uploadedAt);
            const dtStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
            const fileList = (r.filenames || []).join(', ') || '-';
            const weekTypeLabel = r.weekType === 'current' ? '현재주차' : '소급';
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-3 px-4">${pbadge(r.platform)}</td>
                    <td class="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">${dtStr}</td>
                    <td class="py-3 px-4 text-xs text-gray-700">
                        <div class="font-medium" title="${fileList}">${fileList}</div>
                        <div class="text-gray-400 mt-0.5">${r.weekName || '-'} · <span class="text-blue-500">${weekTypeLabel}</span></div>
                    </td>
                    <td class="py-3 px-4 text-center font-semibold text-blue-700 text-sm">${(r.matchedCount||0).toLocaleString()}건</td>
                    <td class="py-3 px-4 text-center">
                        <button onclick="app.deleteUploadRecord('${r.id}')"
                            class="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-300 rounded-lg hover:bg-red-50 hover:border-red-500 transition-colors">
                            삭제
                        </button>
                    </td>
                </tr>`;
        }).join('');

        // 미추적 데이터 행 (이력 기능 도입 전 업로드)
        const untrackedRows = untrackedEntries.map(([weekName, info]) => {
            const gNames = info.guildNames.slice(0, 3).join(', ') + (info.guildNames.length > 3 ? ` 외 ${info.guildNames.length - 3}개` : '');
            const safeWeek = weekName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `
                <tr class="border-b border-orange-100 hover:bg-orange-50">
                    <td class="py-3 px-4">
                        <span class="inline-block px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-600">미추적</span>
                    </td>
                    <td class="py-3 px-4 text-xs text-gray-400">이력 없음</td>
                    <td class="py-3 px-4 text-xs">
                        <div class="font-medium text-gray-700">${weekName}</div>
                        <div class="text-gray-400 mt-0.5">${gNames}</div>
                    </td>
                    <td class="py-3 px-4 text-center font-semibold text-orange-600 text-sm">${info.total.toLocaleString()}건</td>
                    <td class="py-3 px-4 text-center">
                        <button onclick="app.resetWeekData('${safeWeek}')"
                            class="px-3 py-1.5 text-xs font-bold text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-100 hover:border-orange-500 transition-colors">
                            초기화
                        </button>
                    </td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr class="text-xs text-gray-500 border-b border-gray-200">
                            <th class="py-2.5 px-4 text-left w-20">플랫폼</th>
                            <th class="py-2.5 px-4 text-left w-36">업로드 일시</th>
                            <th class="py-2.5 px-4 text-left">파일명 / 주차</th>
                            <th class="py-2.5 px-4 text-center w-24">건수</th>
                            <th class="py-2.5 px-4 text-center w-24">삭제/초기화</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trackedRows}
                        ${untrackedRows}
                    </tbody>
                </table>
            </div>
            ${untrackedEntries.length > 0 ? `
            <p class="mt-3 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5">
                <strong>미추적 항목</strong>: 이력 기능 도입 전에 업로드된 데이터입니다. [초기화]로 해당 주차 전체 배달 건수를 0으로 리셋 후 재업로드할 수 있습니다.
            </p>` : ''}
        `;
        lucide.createIcons();
    },

    resetSettlementData(settlementId) {
        if (!confirm('이 길드의 배달 건수를 0으로 초기화하시겠습니까?\n초기화 후 올바른 엑셀을 다시 업로드하세요.')) return;
        const ok = db.resetSettlementDeliveries(settlementId, SettlementEngine);
        if (ok) {
            alert('초기화 완료. 엑셀 업로드 메뉴에서 올바른 파일을 다시 업로드하세요.');
            this.renderUploadHistory(document.getElementById('app-content'));
        } else {
            alert('초기화 실패.');
        }
    },

    resetWeekData(weekName) {
        if (!confirm(`'${weekName}'\n이 주차의 모든 길드 배달 건수를 0으로 초기화하시겠습니까?\n초기화 후 올바른 엑셀을 다시 업로드하세요.`)) return;
        const ok = db.resetWeekDeliveries(weekName, SettlementEngine);
        if (ok) {
            alert('초기화 완료. 엑셀 업로드 메뉴에서 올바른 파일을 다시 업로드하세요.');
            this.renderUploadHistory(document.getElementById('app-content'));
        } else {
            alert('초기화 실패.');
        }
    },

    deleteUploadRecord(uploadId) {
        if (!confirm('이 업로드를 삭제하면 해당 파일로 추가된 배달 건수가 차감됩니다.\n정말 삭제하시겠습니까?')) return;
        const ok = db.deleteUpload(uploadId, SettlementEngine);
        if (ok) {
            alert('삭제 완료. 해당 배달 건수가 차감되었습니다.');
            this.renderUploadHistory(document.getElementById('app-content'));
        } else {
            alert('삭제 실패.');
        }
    },

    renderAdmin(container) {
        if (this.state.currentUser.role !== 'admin') return;
        const guilds = db.getGuilds() || [];
        const currentWeekName = db.getCurrentWeekName();

        let guildRows = guilds.map(g => {
            const activeCount = db.getHeadcountForGuild(g.id);
            const deliveries = db.getTotalDeliveriesForGuild(g.id);
            const settlement = SettlementEngine.calculateSettlement(activeCount, deliveries);
            
            const hasCustomRule = g.customRule && g.customRule.targetCalls > 0;
            const hasCustomInc = g.customIncentives && g.customIncentives.length > 0;
            const isCustomLimit = hasCustomRule || hasCustomInc;
            const displayTier = isCustomLimit ? '단일/인센티브' : settlement.tier;

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
                            <div class="flex items-center space-x-2">
                                <button onclick="app.resetGuild('${g.id}')" class="text-gray-400 hover:text-red-500 transition-colors" title="이 길드만 수동 마감(초기화)">
                                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                                </button>
                                <button onclick="app.promptEditAccount('${g.id}')" class="text-gray-400 hover:text-blue-600 transition-colors" title="길드 정보 수정">
                                    <i data-lucide="pencil" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-sm text-gray-700 text-center">${activeCount}명</td>
                    <td class="py-3 px-4 text-sm text-blue-600 font-bold text-center">${deliveries.toLocaleString()}건</td>
                    <td class="py-3 px-4 text-sm font-medium text-primary-700 text-center">${displayTier}</td>
                    <td class="py-3 px-4 text-sm text-right font-bold text-gray-900">${settlement.totalAmount.toLocaleString()}원</td>
                    <td class="py-3 px-4 text-sm text-center">
                        <div class="flex items-center justify-center flex-wrap gap-1">
                            <button onclick="app.showAdminBulkUploadModal('${g.id}', '${g.name.replace(/'/g, "\\'")}')" class="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 font-bold text-xs flex items-center transition-colors">
                                <i data-lucide="upload" class="w-3 h-3 mr-1"></i> 일괄등록
                            </button>
                            <button onclick="app.switchToGuild('${g.id}')" class="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 font-bold text-xs flex items-center transition-colors">
                                <i data-lucide="log-in" class="w-3 h-3 mr-1"></i> 접속
                            </button>
                            <button onclick="app.handleDeleteGuild('${g.id}')" class="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 font-bold text-xs flex items-center transition-colors">
                                <i data-lucide="trash-2" class="w-3 h-3 mr-1"></i> 삭제
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const currentNotice = db.getNotice();

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <i data-lucide="bell-ring" class="w-5 h-5 mr-2 text-red-500"></i> 전 길드 대상 공지사항 관리
                </h3>
                <div class="flex flex-col sm:flex-row gap-4">
                    <textarea id="admin-notice-input" rows="2" class="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="모든 길드장의 화면 최상단에 고정 노출될 긴급 공지사항을 입력하세요. 비워두면 노출되지 않습니다.">${currentNotice}</textarea>
                    <button onclick="app.saveNotice()" class="bg-red-50 text-red-600 border border-red-200 px-6 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors whitespace-nowrap self-end sm:self-auto h-full min-h-[42px]">
                        공지 업데이트
                    </button>
                </div>
            </div>

            <div id="admin-upgrade-requests-area" class="mb-6"></div>

            <div class="glass-panel rounded-xl border border-gray-100 p-6 mb-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-blue-50 w-64 h-full transform skew-x-12 translate-x-10 z-0"></div>
                <div class="relative z-10 flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">이번 주 실시간 길드 현황 (총 ${guilds.length}개)</h3>
                        <p class="text-sm font-bold text-blue-600 mt-1">
                            <i data-lucide="clock" class="w-4 h-4 inline mb-0.5"></i> 진행 중인 주차: ${currentWeekName}
                        </p>
                        <p class="text-xs text-gray-500 mt-1">수요일 자정이 지나고 사이트 접속 시 시스템이 자동으로 데이터를 마감 처리하고 리셋합니다.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="app.handleForceReset()" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 hover:bg-gray-200 transition-colors shadow-sm flex items-center">
                            <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i>수동 주간 마감
                        </button>
                        <button onclick="app.showMultiBulkUploadModal()" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center">
                            <i data-lucide="layers" class="w-4 h-4 mr-2"></i>전체 일괄 등록
                        </button>
                        <button onclick="document.getElementById('admin-add-modal').classList.remove('hidden')" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm flex items-center">
                            <i data-lucide="plus" class="w-4 h-4 mr-2"></i>신규 길드 생성
                        </button>
                    </div>
                </div>
                
                <div class="overflow-x-auto relative z-10">
                    <table class="w-full text-left bg-white rounded-lg shadow-sm">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 font-semibold rounded-tl-lg">길드명</th>
                                <th class="py-3 px-4 font-semibold">길드장명</th>
                                <th class="py-3 px-4 font-semibold">발급된 계정 정보</th>
                                <th class="py-3 px-4 font-semibold text-center">길드원 수</th>
                                <th class="py-3 px-4 font-semibold text-center text-blue-700">이번주 누적건수</th>
                                <th class="py-3 px-4 font-semibold text-center">예상 등급</th>
                                <th class="py-3 px-4 font-semibold text-right">예상 정산금</th>
                                <th class="py-3 px-4 font-semibold rounded-tr-lg text-center">화면 전환</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${guildRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Admin Guild Creation Modal -->
            <div id="admin-add-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="glass-panel w-full max-w-md rounded-xl shadow-xl max-h-[90vh] flex flex-col">
                    <div class="p-6 pb-4 border-b">
                        <h3 class="text-lg font-semibold text-gray-800">신규 길드 및 접속 계정 생성</h3>
                    </div>
                    <div class="p-6 pt-4 flex-1 overflow-y-auto">
                        <form id="add-guild-form" onsubmit="app.addGuild(event)">
                            <div class="space-y-4 pr-2">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">길드명</label>
                                <input type="text" id="g-name" required placeholder="예: 구로가산 길드" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">길드장(GM) 이름</label>
                                <div class="flex space-x-2">
                                    <input type="text" id="g-gmname" required placeholder="예: 김길동 (여러 명일 경우 콤마로 구분)" class="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <button type="button" onclick="app.appendGmName('g-gmname')" class="px-3 py-2 bg-gray-100 text-gray-700 font-bold border border-gray-300 rounded-md hover:bg-gray-200" title="공동 길드장 추가">
                                        <i data-lucide="user-plus" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Custom Single Rule Setting (Optional) -->
                            <div class="mt-4 border-t pt-4">
                                <h4 class="text-sm font-bold text-blue-800 mb-2">단일 단가제 설정 (팀장 전용 조건부)</h4>
                                <p class="text-xs text-gray-500 mb-3">설정 시 위의 '등급별 정산 기준'과 '인원 제한/최대건수'를 모두 무시하고, 단순히 <strong class="text-blue-700">인원수 상관없이 [기준 콜수]당 [금액]</strong>을 무한대로 지급합니다.</p>
                                <div class="grid grid-cols-2 gap-2 bg-blue-50 p-2 rounded border border-blue-200">
                                    <div><label class="text-xs font-bold text-blue-800">기준 콜수(건)</label><input type="number" id="g-custom-calls" placeholder="예: 1000" class="w-full px-2 py-1 text-sm border rounded bg-white"></div>
                                    <div><label class="text-xs font-bold text-blue-800">단위당 금액(원)</label><input type="number" id="g-custom-price" placeholder="예: 100000" class="w-full px-2 py-1 text-sm border rounded bg-white"></div>
                                </div>
                            </div>

                            <!-- Monthly Incentive Setting -->
                            <div class="mt-4 border-t pt-4">
                                <h4 class="text-sm font-bold text-emerald-700 mb-2">팀장 월간 인센티브 (인원당 월평균 콜수 기준)</h4>
                                <p class="text-xs text-gray-500 mb-3">등록된 인원의 한 달(이번 달) 누적 총 콜수를 인원수로 나눈 '월 평균 콜수' 구간에 따라 지급됩니다.</p>
                                <div class="space-y-2 bg-emerald-50 p-3 rounded border border-emerald-200">
                                    <div class="grid grid-cols-3 gap-2 items-end">
                                        <div><label class="text-[10px] font-bold text-emerald-800">최소(이상)</label><input type="number" id="g-inc-min-1" placeholder="15" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-emerald-800">최대(미만)</label><input type="number" id="g-inc-max-1" placeholder="25" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-emerald-800">지급액(원)</label><input type="number" id="g-inc-amt-1" placeholder="30000" class="w-full px-2 py-1 text-xs border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 items-end">
                                        <div><input type="number" id="g-inc-min-2" placeholder="25" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="g-inc-max-2" placeholder="35" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="g-inc-amt-2" placeholder="50000" class="w-full px-2 py-1 text-xs border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 items-end">
                                        <div><input type="number" id="g-inc-min-3" placeholder="35" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="g-inc-max-3" placeholder="" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="g-inc-amt-3" placeholder="70000" class="w-full px-2 py-1 text-xs border rounded"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Custom Tier Settings (Optional) -->
                            <div class="mt-4 border-t pt-4">
                                <h4 class="text-sm font-bold text-gray-800 mb-2">등급별 정산 기준 설정 (선택)</h4>
                                <p class="text-xs text-gray-500 mb-3">비워둘 경우 기본 시스템 설정이 적용됩니다. (기본- Gold: 20명/8만, Silver: 15명/7만, Bronze: 10명/6만)</p>
                                
                                <div class="space-y-3">
                                    <div class="grid grid-cols-3 gap-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                                        <div><label class="text-[10px] font-bold text-yellow-800">Gold 최소인원</label><input type="number" id="g-gold-min" placeholder="20" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-yellow-800">기준 콜수(건)</label><input type="number" id="g-gold-block" placeholder="1000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-yellow-800">단위당 금액(원)</label><input type="number" id="g-gold-price" placeholder="80000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 bg-gray-100 p-2 rounded border border-gray-300">
                                        <div><label class="text-[10px] font-bold text-gray-700">Silver 최소인원</label><input type="number" id="g-silver-min" placeholder="15" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-gray-700">기준 콜수(건)</label><input type="number" id="g-silver-block" placeholder="1000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-gray-700">단위당 금액(원)</label><input type="number" id="g-silver-price" placeholder="70000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 bg-orange-50 p-2 rounded border border-orange-200">
                                        <div><label class="text-[10px] font-bold text-orange-800">Bronze 최소인원</label><input type="number" id="g-bronze-min" placeholder="10" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-orange-800">기준 콜수(건)</label><input type="number" id="g-bronze-block" placeholder="1000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-orange-800">단위당 금액(원)</label><input type="number" id="g-bronze-price" placeholder="60000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                    </div>
                                </div>
                            </div>
                            <p class="text-xs text-gray-500">※ 생성 완료 시 접속용 아이디와 임시 비밀번호가 자동 발급됩니다.</p>
                            </div>
                            <div class="mt-6 pt-4 border-t flex justify-end space-x-3 sticky bottom-0 bg-white py-2 z-10">
                                <button type="button" onclick="document.getElementById('admin-add-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">취소</button>
                                <button type="submit" class="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700">생성하기</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Admin Account Edit Modal -->
            <div id="admin-edit-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="glass-panel w-full max-w-md rounded-xl shadow-xl max-h-[90vh] flex flex-col">
                    <div class="p-6 pb-4 border-b">
                        <h3 class="text-lg font-semibold text-blue-800"><i data-lucide="pencil" class="w-5 h-5 inline mr-1"></i>길드 정보 수정</h3>
                    </div>
                    <div class="p-6 pt-4 flex-1 overflow-y-auto">
                        <form id="edit-account-form" onsubmit="app.updateAccount(event)">
                            <input type="hidden" id="edit-g-id">
                            <div class="space-y-4 pr-2">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">길드명</label>
                                    <input type="text" id="edit-g-name-input" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">길드장 이름</label>
                                    <div class="flex space-x-2">
                                        <input type="text" id="edit-g-gmname-input" required placeholder="콤마로 구분" class="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <button type="button" onclick="app.appendGmName('edit-g-gmname-input')" class="px-2 py-2 bg-gray-100 text-gray-700 font-bold border border-gray-300 rounded-md hover:bg-gray-200" title="공동 길드장 추가">
                                            <i data-lucide="user-plus" class="w-4 h-4"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">접속 아이디</label>
                                    <input type="text" id="edit-g-id-input" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                                    <input type="text" id="edit-g-pw-input" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                            </div>
                            
                            <!-- Custom Single Rule Setting (Optional) -->
                            <div class="mt-4 border-t pt-4">
                                <h4 class="text-sm font-bold text-blue-800 mb-2">단일 단가제 (인원제한 무시)</h4>
                                <p class="text-xs text-gray-500 mb-3">팀원 인원수 상관없이 콜수로만 단순 비례 지급합니다.</p>
                                <div class="grid grid-cols-2 gap-2 bg-blue-50 p-2 rounded border border-blue-200">
                                    <div><label class="text-xs font-bold text-blue-800">기준 콜수(건)</label><input type="number" id="edit-g-custom-calls" placeholder="예: 1000" class="w-full px-2 py-1 text-sm border rounded bg-white"></div>
                                    <div><label class="text-xs font-bold text-blue-800">단위당 금액(원)</label><input type="number" id="edit-g-custom-price" placeholder="예: 100000" class="w-full px-2 py-1 text-sm border rounded bg-white"></div>
                                </div>
                            </div>

                            <!-- Monthly Incentive Setting -->
                            <div class="mt-4 border-t pt-4">
                                <h4 class="text-sm font-bold text-emerald-700 mb-2">팀장 월간 인센티브 (인원당 월평균 콜수 기준)</h4>
                                <p class="text-xs text-gray-500 mb-3">등록된 인원의 한 달 누적 총 콜수를 인원수로 나눈 '월 평균 콜수' 구간에 따라 지급됩니다.</p>
                                <div class="space-y-2 bg-emerald-50 p-3 rounded border border-emerald-200">
                                    <div class="grid grid-cols-3 gap-2 items-end">
                                        <div><label class="text-[10px] font-bold text-emerald-800">최소(이상)</label><input type="number" id="edit-g-inc-min-1" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-emerald-800">최대(미만)</label><input type="number" id="edit-g-inc-max-1" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-emerald-800">지급액(원)</label><input type="number" id="edit-g-inc-amt-1" class="w-full px-2 py-1 text-xs border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 items-end">
                                        <div><input type="number" id="edit-g-inc-min-2" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="edit-g-inc-max-2" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="edit-g-inc-amt-2" class="w-full px-2 py-1 text-xs border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 items-end">
                                        <div><input type="number" id="edit-g-inc-min-3" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="edit-g-inc-max-3" class="w-full px-2 py-1 text-xs border rounded"></div>
                                        <div><input type="number" id="edit-g-inc-amt-3" class="w-full px-2 py-1 text-xs border rounded"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Custom Tier Settings (Optional) -->
                            <div class="mt-4 border-t pt-4">
                                <h4 class="text-sm font-bold text-gray-800 mb-2">등급별 정산 기준 변경</h4>
                                <p class="text-xs text-gray-500 mb-3">비워둘 경우 시스템 기본 설정이 유지됩니다.</p>
                                
                                <div class="space-y-3">
                                    <div class="grid grid-cols-3 gap-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                                        <div><label class="text-[10px] font-bold text-yellow-800">Gold 최소인원</label><input type="number" id="edit-g-gold-min" placeholder="20" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-yellow-800">기준 콜수(건)</label><input type="number" id="edit-g-gold-block" placeholder="1000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-yellow-800">단위당 금액(원)</label><input type="number" id="edit-g-gold-price" placeholder="80000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 bg-gray-100 p-2 rounded border border-gray-300">
                                        <div><label class="text-[10px] font-bold text-gray-700">Silver 최소인원</label><input type="number" id="edit-g-silver-min" placeholder="15" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-gray-700">기준 콜수(건)</label><input type="number" id="edit-g-silver-block" placeholder="1000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-gray-700">단위당 금액(원)</label><input type="number" id="edit-g-silver-price" placeholder="70000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 bg-orange-50 p-2 rounded border border-orange-200">
                                        <div><label class="text-[10px] font-bold text-orange-800">Bronze 최소인원</label><input type="number" id="edit-g-bronze-min" placeholder="10" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-orange-800">기준 콜수(건)</label><input type="number" id="edit-g-bronze-block" placeholder="1000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                        <div><label class="text-[10px] font-bold text-orange-800">단위당 금액(원)</label><input type="number" id="edit-g-bronze-price" placeholder="60000" class="w-full px-2 py-1 text-sm border rounded"></div>
                                    </div>
                                </div>
                            </div>
                            </div>
                            <div class="mt-6 pt-4 border-t flex justify-end space-x-3 sticky bottom-0 bg-white py-2 z-10">
                                <button type="button" onclick="document.getElementById('admin-edit-modal').classList.add('hidden')" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">취소</button>
                                <button type="submit" class="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">변경사항 저장</button>
                            </div>
                        </form>
                    </div>
            </div>
        `;
        lucide.createIcons();
        this.renderAdminUpgradeRequests();
    },

    renderAdminUpgradeRequests() {
        const requests = db.getUpgradeRequests().filter(r => r.status === 'pending');
        const area = document.getElementById('admin-upgrade-requests-area');
        if (!area) return;

        if (requests.length === 0) {
            area.innerHTML = '';
            return;
        }

        const rows = requests.map(r => {
            const guild = db.getGuildById(r.guildId);
            return `
                <div class="flex items-center justify-between p-4 bg-white border border-purple-100 rounded-xl mb-3 shadow-sm">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mr-4 text-purple-600 shrink-0">
                            <i data-lucide="arrow-big-up-dash" class="w-6 h-6"></i>
                        </div>
                        <div class="min-w-0">
                            <p class="text-sm font-bold text-gray-800 truncate">${guild ? guild.name : '알 수 없는 길드'}</p>
                            <p class="text-xs text-gray-500">${r.currentTier} ➜ <span class="text-purple-600 font-bold">${r.requestedTier}</span> 승급 요청</p>
                        </div>
                    </div>
                    <div class="flex space-x-2 shrink-0">
                        <button onclick="app.handleApproveUpgrade('${r.id}')" class="px-4 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors">승인</button>
                        <button onclick="app.handleRejectUpgrade('${r.id}')" class="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">거절</button>
                    </div>
                </div>
            `;
        }).join('');

        area.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <i data-lucide="star" class="w-5 h-5 mr-2 text-purple-500"></i> 승급 신청 대기 목록 (${requests.length}건)
            </h3>
            ${rows}
        `;
        lucide.createIcons();
    },

    handleApproveUpgrade(id) {
        if (confirm('이 승급 요청을 승인하시겠습니까? 승인 시 해당 길드의 인원 제한이 상향됩니다.')) {
            db.approveUpgrade(id);
            alert('승급이 완료되었습니다.');
            this.navigate('admin-overview');
        }
    },

    handleRejectUpgrade(id) {
        if (confirm('이 승급 요청을 거절하시겠습니까?')) {
            db.rejectUpgrade(id);
            this.navigate('admin-overview');
        }
    },

    handleForceReset() {
        if (!confirm('현재 쌓인 모든 길드의 주간 누적 실적을 과거 정산 내역으로 넘기고 0으로 초기화(리셋) 하시겠습니까?\n\n(참고: 시스템이 원래 매주 수요일에 이 작업을 자동으로 수행합니다)')) return;
        
        db.forceResetWeekly(SettlementEngine);
        alert('주간 실적이 수동으로 마감되어 과거 내역으로 이동되었으며, 모든 콜수가 0으로 리셋되었습니다.');
        this.renderAdmin(document.getElementById('app-content'));
    },

    renderAdminHistory(container, selectedWeek = null) {
        if (this.state.currentUser.role !== 'admin') return;
        
        const allSettlements = db.getAllSettlements();
        if (allSettlements.length === 0) {
            container.innerHTML = `
                <div class="glass-panel rounded-xl border border-gray-100 p-12 text-center">
                    <i data-lucide="wallet" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">과거 정산 내역이 없습니다</h3>
                    <p class="text-sm text-gray-500">아직 마감된 정산 기록이 존재하지 않습니다.</p>
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
            const guildName = guilds.find(g => g.id === s.guildId)?.name || '알 수 없음';
            const gmName = guilds.find(g => g.id === s.guildId)?.gmName || '알 수 없음';
            
            const btnClass = s.isPaid 
                ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' 
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200';
            const icon = s.isPaid ? 'check-circle-2' : 'clock';
            const btnText = s.isPaid ? '지급 완료됨' : '지급 대기중';

            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-4 text-sm font-medium text-gray-900">${guildName}</td>
                    <td class="py-4 px-4 text-sm text-gray-700">${gmName}</td>
                    <td class="py-4 px-4 text-sm text-center text-gray-600">${s.memberCount}명</td>
                    <td class="py-4 px-4 text-sm text-center text-gray-600">${s.totalDeliveries.toLocaleString()}건</td>
                    <td class="py-4 px-4 text-sm text-center font-bold text-primary-700">${s.tier}</td>
                    <td class="py-4 px-4 text-sm text-right font-black text-blue-600">${s.totalAmount.toLocaleString()}원</td>
                    <td class="py-4 px-4 text-sm text-right flex items-center justify-end space-x-2">
                        <button onclick="app.promptEditSettlement('${s.id}')" class="px-2 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center" title="정산 내역 수정(보정)">
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
                            <i data-lucide="calendar-days" class="w-5 h-5 mr-2 text-primary-600"></i> 과거 정산 내역 및 지급 상태 관리
                        </h3>
                        <p class="text-xs text-gray-500 mt-1">이전에 마감된 주차의 정산 결과를 확인하고, 입금이 완료된 길드를 체크하세요.</p>
                    </div>
                    <div class="w-full sm:w-auto flex flex-col sm:flex-row gap-4 items-end">
                        <button onclick="app.downloadTransferExcel('${activeWeek}')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center h-full min-h-[42px] w-full sm:w-auto justify-center">
                            <i data-lucide="download" class="w-4 h-4 mr-2"></i>이체용 엑셀 다운로드
                        </button>
                        <div class="w-full sm:w-64">
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">조회할 주차 선택</label>
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
                                <th class="py-3 px-4 font-semibold rounded-tl-lg">길드명</th>
                                <th class="py-3 px-4 font-semibold">길드장명</th>
                                <th class="py-3 px-4 font-semibold text-center">마감 인원</th>
                                <th class="py-3 px-4 font-semibold text-center">총 배달건수</th>
                                <th class="py-3 px-4 font-semibold text-center">달성 등급</th>
                                <th class="py-3 px-4 font-semibold text-right">최종 확정 지급액</th>
                                <th class="py-3 px-4 font-semibold rounded-tr-lg text-right">관리 / 상태 변경</th>
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
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">승인 대기 중인 길드원이 없습니다</h3>
                    <p class="text-sm text-gray-500">모든 길드원 가입 요청이 처리되었습니다.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        let rows = pendingMembers.map(m => {
            const guildName = guilds.find(g => g.id === m.guildId)?.name || '알 수 없음';
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="py-4 px-4 text-sm font-medium text-gray-900">${guildName}</td>
                    <td class="py-4 px-4 text-sm text-gray-800 font-bold">${m.name}</td>
                    <td class="py-4 px-4 text-sm text-gray-600 font-mono">${m.baeminId || '-'}</td>
                    <td class="py-4 px-4 text-sm text-gray-600 font-mono">${m.coupangPhone || '-'}</td>
                    <td class="py-4 px-4 text-sm text-gray-500 max-w-[150px] truncate" title="${m.memo || ''}">${m.memo || '-'}</td>
                    <td class="py-4 px-4 text-sm text-right">
                        <button onclick="app.approveMember('${m.id}')" class="px-3 py-1.5 rounded-md text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors mr-2">
                            승인
                        </button>
                        <button onclick="app.rejectMember('${m.id}')" class="px-3 py-1.5 rounded-md text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                            반려
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6 shadow-sm">
                <div class="mb-6 pb-4 border-b border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                        <i data-lucide="user-plus" class="w-5 h-5 mr-2 text-primary-600"></i> 신규 길드원 가입 승인 대기 목록
                        <span class="ml-3 bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">${pendingMembers.length}명 대기중</span>
                    </h3>
                    <p class="text-xs text-gray-500 mt-2">각 길드장이 등록한 신규 인원을 확인하고 승인해 주세요. 승인 전까지는 인원수 및 실적 합산에 포함되지 않습니다.</p>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 font-semibold rounded-tl-lg">소속 길드</th>
                                <th class="py-3 px-4 font-semibold">이름</th>
                                <th class="py-3 px-4 font-semibold">배민 ID</th>
                                <th class="py-3 px-4 font-semibold">쿠팡 뒷자리</th>
                                <th class="py-3 px-4 font-semibold">메모(비고)</th>
                                <th class="py-3 px-4 font-semibold rounded-tr-lg text-right">관리 액션</th>
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

    renderRegistrationHistory(container) {
        if (this.state.currentUser.role !== 'admin') return;
        
        const history = (db.getData().registrationHistory || []).reverse();
        const guilds = db.getGuilds();

        if (history.length === 0) {
            container.innerHTML = `
                <div class="glass-panel rounded-xl border border-gray-100 p-12 text-center">
                    <i data-lucide="scroll-text" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">등록 이력이 없습니다</h3>
                    <p class="text-sm text-gray-500">길드 또는 길드원 등록이 발생하면 이곳에 기록됩니다.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        let rows = history.map(item => {
            const guild = guilds.find(g => g.id === item.guildId);
            const typeBadge = item.type === 'guild_add' 
                ? '<span class="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">길드 생성</span>'
                : '<span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">멤버 추가</span>';
            
            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-3 px-4 text-xs text-gray-500">${new Date(item.timestamp).toLocaleString()}</td>
                    <td class="py-3 px-4">${typeBadge}</td>
                    <td class="py-3 px-4 text-sm font-bold text-gray-800">${item.name}</td>
                    <td class="py-3 px-4 text-sm text-gray-600">${guild ? guild.name : '알 수 없음'}</td>
                    <td class="py-3 px-4 text-xs text-gray-400 italic">${item.details || '-'}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="glass-panel rounded-xl border border-gray-100 p-6 shadow-sm">
                <div class="mb-6 border-b pb-4">
                    <h3 class="text-lg font-semibold text-gray-800">시스템 전체 등록 타임라인</h3>
                    <p class="text-xs text-gray-500 mt-1">누락된 데이터를 추적하고 모든 변경 사항을 투명하게 관리하기 위한 이력 로그입니다.</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 font-semibold">발생 시각</th>
                                <th class="py-3 px-4 font-semibold">유형</th>
                                <th class="py-3 px-4 font-semibold">대상명</th>
                                <th class="py-3 px-4 font-semibold">소속 길드</th>
                                <th class="py-3 px-4 font-semibold">상세 내용</th>
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
            // 브라우저 팝업 차단 문제 우회
            db.updateMemberStatus(id, 'approved');
            app.renderAdminApprovals(document.getElementById('app-content'));
        } catch(e) {
            console.error(e);
        }
    },

    rejectMember(id) {
        try {
            // 브라우저 팝업 차단 문제 우회
            db.updateMemberStatus(id, 'rejected');
            app.renderAdminApprovals(document.getElementById('app-content'));
        } catch(e) {
            console.error(e);
        }
    },

    promptEditAccount(guildId) {
        const g = db.getGuildById(guildId);
        if (!g) return;

        document.getElementById('edit-g-id').value = g.id;
        document.getElementById('edit-g-name-input').value = g.name;
        document.getElementById('edit-g-gmname-input').value = g.gmName;
        document.getElementById('edit-g-id-input').value = g.username;
        document.getElementById('edit-g-pw-input').value = g.password;

        const tiers = g.customTiers || {};
        const rule = g.customRule || {};
        const incs = g.customIncentives || [];

        document.getElementById('edit-g-custom-calls').value = rule.targetCalls || '';
        document.getElementById('edit-g-custom-price').value = rule.rewardPerTarget || '';

        for (let i = 0; i < 3; i++) {
            const inc = incs[i] || {};
            document.getElementById(`edit-g-inc-min-${i+1}`).value = inc.min != null ? inc.min : '';
            document.getElementById(`edit-g-inc-max-${i+1}`).value = (inc.max != null && inc.max !== Infinity) ? inc.max : '';
            document.getElementById(`edit-g-inc-amt-${i+1}`).value = inc.amount != null ? inc.amount : '';
        }

        document.getElementById('edit-g-gold-min').value = tiers.Gold?.minMembers || '';
        document.getElementById('edit-g-gold-block').value = tiers.Gold?.callsPerBlock || '';
        document.getElementById('edit-g-gold-price').value = tiers.Gold?.pricePer1000 || '';
        document.getElementById('edit-g-silver-min').value = tiers.Silver?.minMembers || '';
        document.getElementById('edit-g-silver-block').value = tiers.Silver?.callsPerBlock || '';
        document.getElementById('edit-g-silver-price').value = tiers.Silver?.pricePer1000 || '';
        document.getElementById('edit-g-bronze-min').value = tiers.Bronze?.minMembers || '';
        document.getElementById('edit-g-bronze-block').value = tiers.Bronze?.callsPerBlock || '';
        document.getElementById('edit-g-bronze-price').value = tiers.Bronze?.pricePer1000 || '';

        document.getElementById('admin-edit-modal').classList.remove('hidden');
    },

    appendGmName(inputId) {
        const input = document.getElementById(inputId);
        const name = prompt('추가할 공동 길드장의 이름을 입력하세요.');
        if (name && name.trim()) {
            if (input.value) {
                input.value = input.value + ', ' + name.trim();
            } else {
                input.value = name.trim();
            }
        }
    },

    updateAccount(e) {
        e.preventDefault();
        const guildId = document.getElementById('edit-g-id').value;
        const newName = document.getElementById('edit-g-name-input').value.trim();
        const newGmName = document.getElementById('edit-g-gmname-input').value.trim();
        const newId = document.getElementById('edit-g-id-input').value.trim();
        const newPw = document.getElementById('edit-g-pw-input').value.trim();

        if (newId === '' || newName === '' || newGmName === '') {
            alert('필수 정보(이름/아이디)를 모두 입력해주세요.');
            return;
        }

        const customTiers = {
            Gold: { 
                minMembers: parseInt(document.getElementById('edit-g-gold-min').value) || 20, 
                callsPerBlock: parseInt(document.getElementById('edit-g-gold-block').value) || 1000,
                pricePer1000: parseInt(document.getElementById('edit-g-gold-price').value) || 80000 
            },
            Silver: { 
                minMembers: parseInt(document.getElementById('edit-g-silver-min').value) || 15, 
                callsPerBlock: parseInt(document.getElementById('edit-g-silver-block').value) || 1000,
                pricePer1000: parseInt(document.getElementById('edit-g-silver-price').value) || 70000 
            },
            Bronze: { 
                minMembers: parseInt(document.getElementById('edit-g-bronze-min').value) || 10, 
                callsPerBlock: parseInt(document.getElementById('edit-g-bronze-block').value) || 1000,
                pricePer1000: parseInt(document.getElementById('edit-g-bronze-price').value) || 60000 
            }
        };

        const targetCalls = parseInt(document.getElementById('edit-g-custom-calls').value);
        const rewardPerTarget = parseInt(document.getElementById('edit-g-custom-price').value);
        const customRule = (!isNaN(targetCalls) && !isNaN(rewardPerTarget)) 
            ? { targetCalls, rewardPerTarget } 
            : null;

        const customIncentives = [];
        for (let i = 1; i <= 3; i++) {
            const min = parseInt(document.getElementById(`edit-g-inc-min-${i}`).value);
            const max = parseInt(document.getElementById(`edit-g-inc-max-${i}`).value);
            const amount = parseInt(document.getElementById(`edit-g-inc-amt-${i}`).value);
            if (!isNaN(min) && !isNaN(amount)) {
                customIncentives.push({ min, max: isNaN(max) ? Infinity : max, amount });
            }
        }

        const guild = db.getGuildById(guildId);
        const bankName = guild ? guild.bankName : '';
        const accountNumber = guild ? guild.accountNumber : '';

        db.updateGuild(guildId, newId, newPw, bankName, accountNumber, customTiers, newName, newGmName, customRule, customIncentives);
        document.getElementById('admin-edit-modal').classList.add('hidden');
        this.renderAdmin(document.getElementById('app-content'));
        alert('길드 정보가 성공적으로 변경되었습니다.');
    },

    addGuild(e) {
        e.preventDefault();
        const name = document.getElementById('g-name').value;
        const gmName = document.getElementById('g-gmname').value;
        
        const customTiers = {
            Gold: { 
                minMembers: parseInt(document.getElementById('g-gold-min').value) || 20, 
                callsPerBlock: parseInt(document.getElementById('g-gold-block').value) || 1000,
                pricePer1000: parseInt(document.getElementById('g-gold-price').value) || 80000 
            },
            Silver: { 
                minMembers: parseInt(document.getElementById('g-silver-min').value) || 15, 
                callsPerBlock: parseInt(document.getElementById('g-silver-block').value) || 1000,
                pricePer1000: parseInt(document.getElementById('g-silver-price').value) || 70000 
            },
            Bronze: { 
                minMembers: parseInt(document.getElementById('g-bronze-min').value) || 10, 
                callsPerBlock: parseInt(document.getElementById('g-bronze-block').value) || 1000,
                pricePer1000: parseInt(document.getElementById('g-bronze-price').value) || 60000 
            }
        };

        const targetCalls = parseInt(document.getElementById('g-custom-calls').value);
        const rewardPerTarget = parseInt(document.getElementById('g-custom-price').value);
        const customRule = (!isNaN(targetCalls) && !isNaN(rewardPerTarget)) 
            ? { targetCalls, rewardPerTarget } 
            : null;

        const customIncentives = [];
        for (let i = 1; i <= 3; i++) {
            const min = parseInt(document.getElementById(`g-inc-min-${i}`).value);
            const max = parseInt(document.getElementById(`g-inc-max-${i}`).value);
            const amount = parseInt(document.getElementById(`g-inc-amt-${i}`).value);
            if (!isNaN(min) && !isNaN(amount)) {
                customIncentives.push({ min, max: isNaN(max) ? Infinity : max, amount });
            }
        }

        db.createGuild(name, gmName, '', '', customTiers, customRule, customIncentives);
        document.getElementById('admin-add-modal').classList.add('hidden');
        this.renderAdmin(document.getElementById('app-content'));
    },

    handleDeleteGuild(guildId) {
        const guild = db.getGuildById(guildId);
        const guildName = guild ? guild.name : guildId;
        if (confirm(`[${guildName}] 길드를 정말 삭제하시겠습니까?\n삭제 시 해당 길드의 모든 멤버 데이터도 함께 영구 삭제되며 복구할 수 없습니다.`)) {
            db.deleteGuild(guildId);
            alert(`[${guildName}] 길드가 삭제되었습니다.`);
            this.renderAdmin(document.getElementById('app-content'));
        }
    },

    resetWeekly() {
        if (confirm('주의: 강제로 현재 진행중인 주간 데이터가 과거 정산 내역으로 마감되고 초기화됩니다. 이 작업은 되돌릴 수 없습니다. 진행하시겠습니까?')) {
            const weekName = db.forceResetWeekly(SettlementEngine);
            if (weekName) {
                alert(`성공적으로 [${weekName}] 로 마감되었습니다.`);
                this.renderAdmin(document.getElementById('app-content'));
            } else {
                alert('초기화에 실패했습니다.');
            }
        }
    },

    resetGuild(guildId) {
        if (confirm('주의: 이 팀의 진행중인 주간 데이터만 강제로 마감되고 초기화됩니다. 계속하시겠습니까?')) {
            const weekName = db.forceResetGuildWeekly(guildId, SettlementEngine);
            if (weekName) {
                alert(`해당 팀이 [${weekName}] 로 개별 마감되었습니다.`);
                const content = document.getElementById('app-content');
                if (this.state.currentUser.role === 'admin') {
                    this.renderAdmin(content);
                } else {
                    this.renderDashboard(content);
                }
            } else {
                alert('초기화에 실패했습니다.');
            }
        }
    },

    saveNotice() {
        const text = document.getElementById('admin-notice-input').value;
        db.updateNotice(text);
        alert('공지사항이 업데이트 되었습니다. 길드장 대시보드 상단에 즉시 노출됩니다.');
    },

    promptEditSettlement(settlementId) {
        try {
            const data = db.getData();
            const s = data.settlements.find(x => x.id === settlementId);
            if(!s) return;
            
            const countStr = prompt(`[${s.weekName}] 최종 인정 건수를 입력하세요. (기존: ${s.totalDeliveries}건)`, s.totalDeliveries);
            if(countStr === null) return;
            
            const amtStr = prompt(`[${s.weekName}] 최종 확정 지급액을 입력하세요. (기존: ${s.totalAmount}원)`, s.totalAmount);
            if(amtStr === null) return;

            const newCount = parseInt(countStr.replace(/,/g, ''), 10);
            const newAmt = parseInt(amtStr.replace(/,/g, ''), 10);

            if(isNaN(newCount) || isNaN(newAmt)) {
                alert('올바른 숫자를 입력해주세요.');
                return;
            }

            db.updateSettlementManual(settlementId, newCount, newAmt);
            alert('과거 정산 내역이 강제 보정되었습니다.');
            this.renderAdminHistory(document.getElementById('app-content'), s.weekName);
        } catch(e) {
            console.error(e);
        }
    },

    downloadTransferExcel(weekName) {
        const settlements = db.getAllSettlements().filter(s => s.weekName === weekName);
        if(settlements.length === 0) {
            alert('해당 주차에 다운로드할 데이터가 없습니다.');
            return;
        }

        const guilds = db.getGuilds();
        
        // CSV Header
        let csvContent = "\\uFEFF"; // BOM for excel encoding
        csvContent += "은행명,계좌번호,예금주(길드장명),소속길드,이체금액(원),비고(주차)\\n";

        settlements.forEach(s => {
            const g = guilds.find(x => x.id === s.guildId);
            if(g) {
                // Remove commas from strings to not break CSV
                const bank = (g.bankName || '은행미입력').replace(/,/g, '');
                const acc = (g.accountNumber || '계좌미입력').replace(/,/g, '').replace(/-/g, '');
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
        link.setAttribute("download", `이체양식_${weekName.replace(/\\s/g,'_')}.csv`);
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
            alert('배민 커넥트 ID 또는 쿠팡이츠 뒷자리 중 최소 하나는 입력해야 실적 매칭이 가능합니다.');
            return;
        }

        try {
            // 인원 제한 체크 (동적 등급 기준) - 단일단가제 또는 월간인센티브 시 인원제한/등급 검증 무시
            const guild = db.getGuildById(guildId);
            const hasCustomRule = guild && guild.customRule && guild.customRule.targetCalls > 0;
            const hasCustomInc = guild && guild.customIncentives && guild.customIncentives.length > 0;
            const isCustomLimit = hasCustomRule || hasCustomInc;

            if (!isCustomLimit) {
                const currentTier = db.getEffectiveTier(guildId);
                const limit = SettlementEngine.Tiers[currentTier]?.limit || 10;
                const currentCount = db.getHeadcountForGuild(guildId);
                
                if (currentCount >= limit) {
                    alert(`현재 ${currentTier} 등급의 최대 인원(${limit}명)에 도달했습니다. 더 많은 인원을 추가하려면 실적을 높여 등급을 올려야 합니다.`);
                    return;
                }
            }

            db.addMember(guildId, { name, baeminId, coupangPhone, memo });
            document.getElementById('add-modal').classList.add('hidden');
            
            // 기록이 남도록 명단 즉시 갱신
            this.renderMembers(document.getElementById('app-content'));
            console.log(`[Success] Member added: ${name}`);
        } catch (error) {
            alert(error.message);
        }
    },

    showAddMemberModal() {
        document.getElementById('add-member-form').reset();
        document.getElementById('add-modal').classList.remove('hidden');
    },

    // ── 엑셀 양식 다운로드 ──
    downloadMemberTemplate() {
        const wsData = [
            ['이름', '배민커넥트ID', '쿠팡이츠뒷자리', '메모'],
            ['홍길동', 'hong123', '1234', ''],
            ['김철수', 'kim456,kim789', '5678,9012', '타명의 사용'],
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, '길드원명단');
        XLSX.writeFile(wb, '길드원_등록양식.xlsx');
    },

    // ── 일괄 등록 모달 열기 (GM 전용) ──
    showBulkUploadModal() {
        this.state._bulkParsedMembers = [];
        this.state._bulkTargetGuildId = this.state.currentUser.id;
        document.getElementById('bulk-file-input').value = '';
        document.getElementById('bulk-preview-area').classList.add('hidden');
        document.getElementById('bulk-confirm-btn').disabled = true;
        document.getElementById('bulk-upload-modal').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    },

    // ── 파일 파싱 및 미리보기 (GM 전용 — 공통 메서드 사용) ──
    handleBulkUploadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        this._parseBulkFileIntoPreview(file, this.state._bulkTargetGuildId, {
            tbody: 'bulk-preview-tbody',
            count: 'bulk-preview-count',
            preview: 'bulk-preview-area',
            confirmBtn: 'bulk-confirm-btn',
        });
    },

    // ── 일괄 등록 실행 (GM 전용) ──
    confirmBulkUpload() {
        const members = this.state._bulkParsedMembers;
        if (!members || members.length === 0) return;

        const guildId = this.state._bulkTargetGuildId || this.state.currentUser.id;
        const result = db.bulkAddMembers(guildId, members);

        document.getElementById('bulk-upload-modal').classList.add('hidden');

        let msg = `${result.added}명이 등록되었습니다.`;
        if (result.skipped.length > 0) msg += `\n\n인원 초과로 미등록:\n${result.skipped.join('\n')}`;
        alert(msg);

        this.renderMembers(document.getElementById('app-content'));
    },

    // ── 공통: 엑셀 파일 → 파싱 → 미리보기 렌더링 ──
    _parseBulkFileIntoPreview(file, guildId, ids) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                const parsed = rows.slice(1)
                    .filter(r => String(r[0] || '').trim())
                    .map(r => ({
                        name: String(r[0] || '').trim(),
                        baeminId: String(r[1] || '').trim(),
                        coupangPhone: String(r[2] || '').trim(),
                        memo: String(r[3] || '').trim(),
                    }));

                this.state._bulkParsedMembers = parsed;

                const existing = db.getMembers(guildId);
                const existingNames = new Set(existing.map(m => m.name.replace(/\s/g, '')));

                const tbody = document.getElementById(ids.tbody);
                tbody.innerHTML = parsed.map((m, i) => {
                    const dup = existingNames.has(m.name.replace(/\s/g, ''));
                    const warn = !m.baeminId && !m.coupangPhone;
                    const badge = dup
                        ? '<span class="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-bold">중복</span>'
                        : warn
                        ? '<span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold">ID없음</span>'
                        : '<span class="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">정상</span>';
                    return `<tr class="hover:bg-gray-50 ${dup ? 'bg-orange-50' : ''}">
                        <td class="px-3 py-2 text-gray-400 text-xs">${i + 1}</td>
                        <td class="px-3 py-2 font-semibold text-gray-800">${m.name}</td>
                        <td class="px-3 py-2 text-gray-600 font-mono text-xs">${m.baeminId || '-'}</td>
                        <td class="px-3 py-2 text-gray-600 font-mono text-xs">${m.coupangPhone || '-'}</td>
                        <td class="px-3 py-2 text-gray-500 text-xs">${m.memo || ''}</td>
                        <td class="px-3 py-2 text-center">${badge}</td>
                    </tr>`;
                }).join('');

                const dupCount = parsed.filter(m => existingNames.has(m.name.replace(/\s/g, ''))).length;
                document.getElementById(ids.count).textContent =
                    `총 ${parsed.length}명 파싱됨${dupCount > 0 ? ` (중복 ${dupCount}명 포함)` : ''}`;
                document.getElementById(ids.preview).classList.remove('hidden');
                document.getElementById(ids.confirmBtn).disabled = parsed.length === 0;
                if (window.lucide) lucide.createIcons();
            } catch (err) {
                alert('파일 파싱 실패: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    // ── 다중 길드 일괄 등록 양식 다운로드 ──
    downloadMultiGuildTemplate() {
        const guilds = db.getGuilds();
        const header = ['길드명', '이름', '배민커넥트ID', '쿠팡이츠뒷자리', '메모'];
        const examples = guilds.length > 0
            ? guilds.slice(0, 3).map(g => [g.name, '홍길동', 'hong123', '1234', ''])
            : [['길드명예시', '홍길동', 'hong123', '1234', '']];
        const wsData = [header, ...examples];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, '전체길드원명단');
        XLSX.writeFile(wb, '전체_길드원_등록양식.xlsx');
    },

    // ── 전체 일괄 등록 모달 (다중 길드) ──
    showMultiBulkUploadModal() {
        this.state._multiBulkParsed = null;

        const existing = document.getElementById('multi-bulk-modal');
        if (existing) existing.remove();

        const guilds = db.getGuilds();
        const guildListHtml = guilds.map(g =>
            `<span class="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">${g.name}</span>`
        ).join(' ');

        const wrap = document.createElement('div');
        wrap.id = 'multi-bulk-modal';
        wrap.innerHTML = `
            <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[9999] p-4">
                <div class="w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]" style="background:rgba(255,255,255,0.97);border:1px solid rgba(255,255,255,0.2)">
                    <div class="p-6 border-b border-gray-100">
                        <div class="flex items-center justify-between mb-1">
                            <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <i data-lucide="layers" class="w-5 h-5 text-green-600"></i> 전체 길드 일괄 등록
                            </h3>
                            <button onclick="document.getElementById('multi-bulk-modal').remove()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                        </div>
                        <p class="text-xs text-gray-500">엑셀 첫 번째 열에 <strong>길드명</strong>을 정확히 입력하세요. 아래 등록된 길드명과 일치해야 합니다.</p>
                        <div class="mt-2 flex flex-wrap gap-1">${guildListHtml}</div>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1">
                        <label for="multi-bulk-file-input" class="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-green-50 hover:border-green-400 transition-colors">
                            <i data-lucide="file-spreadsheet" class="w-7 h-7 text-gray-400 mb-1.5"></i>
                            <span class="text-sm font-medium text-gray-600">클릭하여 파일 선택 <span class="text-gray-400 font-normal">또는 드래그 앤 드롭</span></span>
                            <span class="text-xs text-gray-400 mt-1">.xlsx / .xls / .csv — 길드명 · 이름 · 배민ID · 쿠팡뒷자리 · 메모</span>
                            <input type="file" id="multi-bulk-file-input" accept=".xlsx,.xls,.csv" class="hidden" onchange="app.handleMultiBulkUploadFile(event)">
                        </label>

                        <div id="multi-bulk-preview-area" class="hidden mt-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <span id="multi-bulk-summary" class="text-sm font-semibold text-gray-700"></span>
                                <button onclick="document.getElementById('multi-bulk-file-input').value=''; document.getElementById('multi-bulk-preview-area').classList.add('hidden'); document.getElementById('multi-bulk-confirm-btn').disabled=true;" class="text-xs text-gray-500 hover:text-red-500">다시 선택</button>
                            </div>
                            <div id="multi-bulk-preview-tables" class="space-y-3 max-h-80 overflow-y-auto pr-1"></div>
                            <div id="multi-bulk-error-area" class="hidden p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1"></div>
                        </div>
                    </div>

                    <div class="p-4 border-t border-gray-100 flex justify-between items-center">
                        <button onclick="app.downloadMultiGuildTemplate()" class="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-700 font-medium">
                            <i data-lucide="download" class="w-4 h-4"></i> 양식 다운로드
                        </button>
                        <div class="flex gap-2">
                            <button onclick="document.getElementById('multi-bulk-modal').remove()" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
                            <button id="multi-bulk-confirm-btn" onclick="app.confirmMultiBulkUpload()" disabled class="px-5 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">전체 등록 확인</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(wrap);
        if (window.lucide) lucide.createIcons();
    },

    handleMultiBulkUploadFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                const guilds = db.getGuilds();
                // 정규화된 길드명 → id 맵
                const nameToId = {};
                guilds.forEach(g => { nameToId[g.name.replace(/\s/g, '')] = g.id; });

                // 파싱: 첫 열 = 길드명, 나머지는 멤버 정보
                const unrecognized = new Set();
                const grouped = {}; // { guildId: [members] }

                rows.slice(1).forEach(r => {
                    const rawGuild = String(r[0] || '').trim();
                    const name = String(r[1] || '').trim();
                    if (!rawGuild && !name) return;

                    const guildId = nameToId[rawGuild.replace(/\s/g, '')];
                    if (!guildId) { if (rawGuild) unrecognized.add(rawGuild); return; }
                    if (!name) return;

                    if (!grouped[guildId]) grouped[guildId] = [];
                    grouped[guildId].push({
                        name,
                        baeminId: String(r[2] || '').trim(),
                        coupangPhone: String(r[3] || '').trim(),
                        memo: String(r[4] || '').trim(),
                        _rawGuildName: rawGuild,
                    });
                });

                this.state._multiBulkParsed = grouped;

                // 미리보기 렌더링
                const tablesEl = document.getElementById('multi-bulk-preview-tables');
                const errorEl = document.getElementById('multi-bulk-error-area');
                let totalMembers = 0;
                let guildCount = 0;

                tablesEl.innerHTML = Object.entries(grouped).map(([gid, members]) => {
                    const guild = guilds.find(g => g.id === gid);
                    const existing = db.getMembers(gid);
                    const existingNames = new Set(existing.map(m => m.name.replace(/\s/g, '')));
                    totalMembers += members.length;
                    guildCount++;

                    const rows = members.map((m, i) => {
                        const dup = existingNames.has(m.name.replace(/\s/g, ''));
                        const warn = !m.baeminId && !m.coupangPhone;
                        const badge = dup
                            ? '<span class="px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-bold">중복</span>'
                            : warn
                            ? '<span class="px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold">ID없음</span>'
                            : '<span class="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">정상</span>';
                        return `<tr class="hover:bg-gray-50 ${dup ? 'bg-orange-50' : ''}">
                            <td class="px-2 py-1.5 text-gray-400 text-xs w-6">${i + 1}</td>
                            <td class="px-2 py-1.5 font-semibold text-gray-800 text-sm">${m.name}</td>
                            <td class="px-2 py-1.5 text-gray-500 font-mono text-xs">${m.baeminId || '-'}</td>
                            <td class="px-2 py-1.5 text-gray-500 font-mono text-xs">${m.coupangPhone || '-'}</td>
                            <td class="px-2 py-1.5 text-gray-400 text-xs">${m.memo || ''}</td>
                            <td class="px-2 py-1.5 text-center">${badge}</td>
                        </tr>`;
                    }).join('');

                    return `
                        <div class="border border-gray-200 rounded-lg overflow-hidden">
                            <div class="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-200">
                                <span class="font-bold text-sm text-gray-800">${guild ? guild.name : gid}</span>
                                <span class="text-xs text-gray-500">${members.length}명</span>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead class="bg-white text-gray-400 text-[10px] uppercase">
                                        <tr>
                                            <th class="px-2 py-1">#</th>
                                            <th class="px-2 py-1">이름</th>
                                            <th class="px-2 py-1">배민ID</th>
                                            <th class="px-2 py-1">쿠팡뒷자리</th>
                                            <th class="px-2 py-1">메모</th>
                                            <th class="px-2 py-1 text-center">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100">${rows}</tbody>
                                </table>
                            </div>
                        </div>`;
                }).join('');

                // 인식 못한 길드명 오류 표시
                if (unrecognized.size > 0) {
                    errorEl.classList.remove('hidden');
                    errorEl.innerHTML = `<strong>인식할 수 없는 길드명 (등록 건너뜀):</strong><br>${[...unrecognized].map(n => `· ${n}`).join('<br>')}`;
                } else {
                    errorEl.classList.add('hidden');
                }

                document.getElementById('multi-bulk-summary').textContent =
                    `${guildCount}개 길드 · 총 ${totalMembers}명`;
                document.getElementById('multi-bulk-preview-area').classList.remove('hidden');
                document.getElementById('multi-bulk-confirm-btn').disabled = totalMembers === 0;
                if (window.lucide) lucide.createIcons();
            } catch (err) {
                alert('파일 파싱 실패: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    confirmMultiBulkUpload() {
        const grouped = this.state._multiBulkParsed;
        if (!grouped || Object.keys(grouped).length === 0) return;

        const results = db.bulkAddMembersMultiGuild(grouped);
        document.getElementById('multi-bulk-modal').remove();

        const lines = Object.values(results).map(r => {
            const skippedStr = r.skipped.length > 0 ? ` (미등록 ${r.skipped.length}명: ${r.skipped.join(', ')})` : '';
            return `· ${r.guildName}: ${r.added}명 등록${skippedStr}`;
        });
        alert(`등록 완료\n\n${lines.join('\n')}`);

        this.renderAdmin(document.getElementById('app-content'));
    },

    // ── 어드민: 길드 선택 후 일괄 등록 모달 열기 ──
    showAdminBulkUploadModal(guildId, guildName) {
        this.state._bulkTargetGuildId = guildId;
        this.state._bulkParsedMembers = [];

        const existing = document.getElementById('admin-bulk-modal');
        if (existing) existing.remove();

        const wrap = document.createElement('div');
        wrap.id = 'admin-bulk-modal';
        wrap.innerHTML = `
            <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[9999] p-4">
                <div class="glass-panel w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]" style="background:rgba(255,255,255,0.97)">
                    <div class="p-6 border-b border-gray-100">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-bold text-gray-800">
                                <span class="text-green-600">${guildName}</span> — 길드원 일괄 등록
                            </h3>
                            <button onclick="document.getElementById('admin-bulk-modal').remove()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">엑셀 양식을 다운로드한 뒤 작성하여 업로드하세요. 이름 컬럼은 필수입니다.</p>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1">
                        <label for="admin-bulk-file-input" class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-green-50 hover:border-green-400 transition-colors">
                            <i data-lucide="file-spreadsheet" class="w-8 h-8 text-gray-400 mb-2"></i>
                            <span class="text-sm font-medium text-gray-600">클릭하여 파일 선택 <span class="text-gray-400 font-normal">또는 드래그 앤 드롭</span></span>
                            <span class="text-xs text-gray-400 mt-1">.xlsx / .xls / .csv 지원</span>
                            <input type="file" id="admin-bulk-file-input" accept=".xlsx,.xls,.csv" class="hidden" onchange="app.handleAdminBulkUploadFile(event)">
                        </label>

                        <div id="admin-bulk-preview-area" class="hidden mt-4">
                            <div class="flex items-center justify-between mb-2">
                                <span id="admin-bulk-preview-count" class="text-sm font-semibold text-gray-700"></span>
                                <button type="button" onclick="document.getElementById('admin-bulk-file-input').value=''; document.getElementById('admin-bulk-preview-area').classList.add('hidden'); document.getElementById('admin-bulk-confirm-btn').disabled=true;" class="text-xs text-gray-500 hover:text-red-500">다시 선택</button>
                            </div>
                            <div class="rounded-xl border border-gray-200 overflow-hidden">
                                <div class="overflow-x-auto max-h-64">
                                    <table class="w-full text-left text-sm">
                                        <thead class="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                                            <tr>
                                                <th class="px-3 py-2">#</th>
                                                <th class="px-3 py-2">이름</th>
                                                <th class="px-3 py-2">배민커넥트ID</th>
                                                <th class="px-3 py-2">쿠팡뒷자리</th>
                                                <th class="px-3 py-2">메모</th>
                                                <th class="px-3 py-2 text-center">상태</th>
                                            </tr>
                                        </thead>
                                        <tbody id="admin-bulk-preview-tbody"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 border-t border-gray-100 flex justify-between items-center">
                        <button onclick="app.downloadMemberTemplate()" class="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-700 font-medium">
                            <i data-lucide="download" class="w-4 h-4"></i> 양식 다운로드
                        </button>
                        <div class="flex gap-2">
                            <button onclick="document.getElementById('admin-bulk-modal').remove()" class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
                            <button id="admin-bulk-confirm-btn" onclick="app.confirmAdminBulkUpload()" disabled class="px-5 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">등록 확인</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(wrap);
        if (window.lucide) lucide.createIcons();
    },

    handleAdminBulkUploadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        this._parseBulkFileIntoPreview(file, this.state._bulkTargetGuildId, {
            tbody: 'admin-bulk-preview-tbody',
            count: 'admin-bulk-preview-count',
            preview: 'admin-bulk-preview-area',
            confirmBtn: 'admin-bulk-confirm-btn',
        });
    },

    confirmAdminBulkUpload() {
        const members = this.state._bulkParsedMembers;
        const guildId = this.state._bulkTargetGuildId;
        if (!members || members.length === 0 || !guildId) return;

        const result = db.bulkAddMembers(guildId, members);
        document.getElementById('admin-bulk-modal').remove();

        let msg = `${result.added}명이 등록되었습니다.`;
        if (result.skipped.length > 0) msg += `\n\n인원 초과로 미등록:\n${result.skipped.join('\n')}`;
        alert(msg);

        this.renderAdmin(document.getElementById('app-content'));
    },

    showEditMemberModal(id) {
        const member = db.getMembers().find(m => m.id === id);
        if (!member) return;

        document.getElementById('edit-m-id').value = id;
        document.getElementById('edit-m-name').value = member.name;
        document.getElementById('edit-m-baemin').value = member.baeminId || '';
        document.getElementById('edit-m-coupang').value = member.coupangPhone || '';
        document.getElementById('edit-m-memo').value = member.memo || '';
        
        document.getElementById('edit-member-modal').classList.remove('hidden');
    },

    handleUpdateMember(e) {
        e.preventDefault();
        const id = document.getElementById('edit-m-id').value;
        const name = document.getElementById('edit-m-name').value.trim();
        const baeminId = document.getElementById('edit-m-baemin').value.trim();
        const coupangPhone = document.getElementById('edit-m-coupang').value.trim();
        const memo = document.getElementById('edit-m-memo').value.trim();

        if (name === '') {
            alert('이름을 입력해주세요.');
            return;
        }

        db.updateMember(id, { name, baeminId, coupangPhone, memo });
        document.getElementById('edit-member-modal').classList.add('hidden');
        this.renderMembers(document.getElementById('app-content'));
        alert('길드원 정보가 수정되었습니다.');
    },

    deleteMember(id) {
        try {
            // 브라우저 팝업(confirm)이 차단된 경우를 대비하여 팝업 없이 즉시 삭제하도록 임시 우회
            db.deleteMember(id);
            app.renderMembers(document.getElementById('app-content'));
        } catch(e) {
            console.error('삭제 중 오류 발생: ', e);
        }
    },

    /**
     * 파일 선택 시 파일명에서 주차를 자동 감지하여 라디오/드롭다운 자동 선택
     */
    _detectAndApplyWeek(fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return;

        const platform = fileInput.id.replace('file-', '');
        const hintEl = document.getElementById(`week-hint-${platform}`);

        // 첫 번째 파일명으로 주차 감지
        const detectedWeek = ExcelParser.detectWeekFromFilename(fileInput.files[0].name);
        if (!detectedWeek) {
            if (hintEl) hintEl.classList.add('hidden');
            return;
        }

        const currentWeek = db.getCurrentWeekName();
        const allSettlements = db.getAllSettlements();
        const pastWeeks = [...new Set(allSettlements.map(s => s.weekName))];

        if (detectedWeek === currentWeek) {
            // 현재 주차 라디오 선택
            const currentRadio = document.querySelector('input[name="target-period"][value="current"]');
            if (currentRadio) {
                currentRadio.checked = true;
                document.getElementById('past-settlement-select').disabled = true;
            }
            if (hintEl) {
                hintEl.textContent = `✅ 자동 감지: 현재 진행 주차 (${detectedWeek})`;
                hintEl.classList.remove('hidden');
            }
        } else if (pastWeeks.includes(detectedWeek)) {
            // 과거 정산 주차 소급 선택
            const pastRadio = document.querySelector('input[name="target-period"][value="past"]');
            if (pastRadio) {
                pastRadio.checked = true;
                const select = document.getElementById('past-settlement-select');
                select.disabled = false;
                select.value = detectedWeek;
            }
            if (hintEl) {
                hintEl.textContent = `📅 자동 감지: 과거 주차 소급 적용 (${detectedWeek})`;
                hintEl.classList.remove('hidden');
            }
        } else {
            // 감지는 됐으나 DB에 없는 주차 (현재 주차와도 다름)
            if (hintEl) {
                hintEl.textContent = `⚠️ 감지된 주차: ${detectedWeek} (현재 주차와 다름 — 수동 선택 필요)`;
                hintEl.classList.remove('hidden');
            }
        }
    },

    async processUpload(platform) {
        const fileInput = document.getElementById(`file-${platform}`);
        if (!fileInput.files.length) {
            alert('업로드할 파일을 하나 이상 선택해주세요.');
            return;
        }

        // 주차 결정 (중복 체크에 필요)
        const targetPeriodEl = document.querySelector('input[name="target-period"]:checked');
        const targetPeriodVal = targetPeriodEl ? targetPeriodEl.value : 'current';
        const pastWeekNameVal = document.getElementById('past-settlement-select').value;
        const targetWeekName = targetPeriodVal === 'current' ? db.getCurrentWeekName() : pastWeekNameVal;

        // 중복 파일 감지: 같은 플랫폼 + 같은 주차에 이미 업로드된 파일명 제외
        const existingUploads = db.getUploadHistory();
        const allFiles = Array.from(fileInput.files);
        const duplicateNames = [];
        const files = allFiles.filter(f => {
            const isDup = existingUploads.some(u =>
                u.platform === platform &&
                u.weekName === targetWeekName &&
                u.filenames && u.filenames.includes(f.name)
            );
            if (isDup) duplicateNames.push(f.name);
            return !isDup;
        });

        if (duplicateNames.length > 0 && files.length === 0) {
            alert(`이미 업로드된 파일입니다:\n${duplicateNames.join('\n')}\n\n삭제 후 다시 업로드하거나 다른 파일을 선택하세요.`);
            return;
        }
        if (duplicateNames.length > 0) {
            alert(`중복 파일 제외됨:\n${duplicateNames.join('\n')}\n\n나머지 ${files.length}개 파일만 처리합니다.`);
        }
        
        // ADMIN UPLOAD: Fetch ALL members across ALL guilds for global matching
        const allActiveMembers = db.getMembers(); 
        
        const resultBox = document.getElementById('upload-result');
        resultBox.classList.remove('hidden');
        resultBox.innerHTML = `
            <div class="p-6 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                <i data-lucide="loader-2" class="w-5 h-5 animate-spin mr-2"></i> ${files.length}개 파일 전체 마스터 DB 파싱 중...
            </div>
        `;
        lucide.createIcons();

        try {
            const result = await ExcelParser.parseMultipleFiles(files, platform, allActiveMembers);

            // 업로드 이력 레코드 준비
            const uploadRecord = {
                id: 'UPL' + Date.now(),
                platform,
                weekType: targetPeriodVal,
                weekName: targetWeekName,
                uploadedAt: new Date().toISOString(),
                filenames: files.map(f => f.name),
                totalRows: result.totalRowsProcessed,
                matchedCount: result.matchedDeliveries,
                memberDeliveries: result.memberDeliveries
            };

            if (targetPeriodVal === 'current') {
                // ADD TO CURRENT COUNTERS — 이력 포함 saveData 1회
                const data = db.getData();
                for (const [memberId, count] of Object.entries(result.memberDeliveries)) {
                    const member = data.members.find(m => m.id === memberId);
                    if (member) member.deliveries = (member.deliveries || 0) + count;
                }
                if (!data.uploadHistory) data.uploadHistory = [];
                data.uploadHistory.push(uploadRecord);
                db.saveData(data);
            } else {
                // UPDATE FINALIZED SETTLEMENTS (소급 적용) + 이력 저장 — saveData 1회
                const guilds = db.getGuilds();
                const members = db.getMembers();
                const data = db.getData();
                let updatedGuildNames = [];

                guilds.forEach(guild => {
                    // 해당 주차에 매칭된 이 길드 소속 멤버 집계
                    const guildMemberDeliveries = {};
                    for (const [mId, count] of Object.entries(result.memberDeliveries)) {
                        const m = members.find(x => x.id === mId);
                        if (m && m.guildId === guild.id) guildMemberDeliveries[mId] = count;
                    }
                    if (Object.keys(guildMemberDeliveries).length === 0) return;

                    let s = data.settlements.find(x => x.guildId === guild.id && x.weekName === targetWeekName);

                    if (!s) {
                        // 전주 정산 레코드 없음 → 신규 생성 (길드가 이번 주 새로 등록된 경우)
                        const approvedMembers = members.filter(m => m.guildId === guild.id && m.status === 'approved');
                        const newRec = {
                            id: 'S' + Date.now() + Math.floor(Math.random() * 1000),
                            weekName: targetWeekName,
                            guildId: guild.id,
                            date: new Date().toISOString().split('T')[0],
                            memberCount: approvedMembers.length,
                            totalDeliveries: 0,
                            tier: 'None',
                            recognizedDeliveries: 0,
                            chunks: [],
                            totalAmount: 0,
                            isPaid: false,
                            memberStats: approvedMembers.map(m => ({ id: m.id, name: m.name, deliveries: 0 })),
                        };
                        data.settlements.push(newRec);
                        s = newRec;
                    }

                    if (!s.memberStats) s.memberStats = [];
                    for (const [mId, count] of Object.entries(guildMemberDeliveries)) {
                        const stat = s.memberStats.find(ms => ms.id === mId);
                        if (stat) {
                            stat.deliveries += count;
                        } else {
                            const member = data.members.find(m => m.id === mId);
                            s.memberStats.push({ id: mId, name: member ? member.name : 'Unknown', deliveries: count });
                        }
                    }
                    s.totalDeliveries = s.memberStats.reduce((sum, ms) => sum + ms.deliveries, 0);
                    const calcResult = SettlementEngine.calculateSettlement(s.memberCount, s.totalDeliveries, guild.customTiers, guild.customRule);
                    s.tier = calcResult.tier;
                    s.recognizedDeliveries = calcResult.recognizedDeliveries;
                    s.chunks = calcResult.chunks;
                    s.totalAmount = calcResult.totalAmount;
                    updatedGuildNames.push(`${guild.name} (+${Object.values(guildMemberDeliveries).reduce((a,b)=>a+b,0)}건)`);
                });

                if (!data.uploadHistory) data.uploadHistory = [];
                data.uploadHistory.push(uploadRecord);
                db.saveData(data);

                result._pastUpdated = updatedGuildNames;
                result._pastWeekName = targetWeekName;
            }

            let unmatchedHtml = '';
            if (result.unmatchedCount > 0) {
                unmatchedHtml = `
                    <div class="mt-4 p-4 bg-red-50 border border-red-100 rounded-md">
                        <p class="text-sm font-medium text-red-800 mb-2"><i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i>매칭 실패 데이터 (${result.unmatchedCount}건)</p>
                        <p class="text-xs text-red-600 mb-2">어느 길드에도 속하지 않은 유령 데이터입니다. 누락이 있다면 길드장에게 등록을 지시하세요.</p>
                        <ul class="text-xs text-gray-700 list-disc pl-5">
                            ${result.unmatchedSamples.map(u => `<li>${u.name || '이름없음'} (식별자: ${u.identifier})</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            const pastUpdateHtml = result._pastUpdated && result._pastUpdated.length > 0 ? `
                <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <p class="text-sm font-bold text-green-800 mb-2">✅ 소급 반영된 길드 (${result._pastWeekName})</p>
                    <ul class="text-xs text-green-700 list-disc pl-5">
                        ${result._pastUpdated.map(g => `<li>${g}</li>`).join('')}
                    </ul>
                </div>
            ` : (result._pastUpdated !== undefined ? `
                <div class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p class="text-sm font-bold text-yellow-800">⚠️ 소급 반영된 길드 없음</p>
                    <p class="text-xs text-yellow-700 mt-1">선택한 주차(${result._pastWeekName})에 매칭되는 길드원 데이터가 없습니다.<br>엑셀의 이름/ID가 등록된 길드원 정보와 일치하는지 확인하세요.</p>
                </div>
            ` : '');

            resultBox.innerHTML = `
                <div class="glass-panel p-6 rounded-xl border-l-4 border-l-green-500 shadow-sm">
                    <div class="flex items-center text-green-700 mb-4">
                        <i data-lucide="check-circle-2" class="w-6 h-6 mr-2"></i>
                        <h4 class="text-lg font-bold">전체 자동 누적 완료</h4>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="bg-gray-50 p-3 rounded">
                            <span class="text-gray-500 block mb-1">총 스캔된 엑셀 행(Row)</span>
                            <span class="font-bold text-gray-900 text-lg">${result.totalRowsProcessed}건</span>
                        </div>
                        <div class="bg-blue-50 p-3 rounded">
                            <span class="text-blue-600 block mb-1">길드원별 매칭 성공</span>
                            <span class="font-bold text-blue-900 text-lg">+${result.matchedDeliveries}건 기존 데이터에 누적됨</span>
                        </div>
                    </div>
                    ${pastUpdateHtml}
                    ${unmatchedHtml}
                    <div class="mt-6 flex justify-end">
                        <button onclick="app.navigate('admin-overview')" class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700">전체 길드 현황 보기</button>
                    </div>
                </div>
            `;
            lucide.createIcons();
            
        } catch (error) {
            resultBox.innerHTML = `
                <div class="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    <div class="font-bold mb-2">오류 발생</div>
                    <div class="text-sm">${error.message || '파일을 읽을 수 없습니다. 양식을 확인해주세요.'}</div>
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
