// public/js/dashboard.js

// --- VARIABLES GLOBALES ---
let investModal, investModalTitle, investModalIdInput;
let depositModal, withdrawModal; 
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. INICIALIZAR REFERENCIAS
    investModal = document.getElementById('invest-modal');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');

    // Referencias pasos inversión
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // --- LÓGICA DE FORMATO DE TARJETA ---
    const cardInput = document.getElementById('card-number');
    if (cardInput) {
        cardInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            value = value.substring(0, 16);
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }

    // --- LÓGICA DE FECHA ---
    const expiryInput = document.getElementById('card-expiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 4) value = value.substring(0, 4);
            if (value.length > 2) value = value.substring(0, 2) + '/' + value.substring(2);
            e.target.value = value;
        });
    }

    // --- SEGURIDAD ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // 2. CARGAR DATOS
    await updateUserData(token);
    loadPortfolios();
    renderMarketChart();

    // Botón Ver Todos
    const btnVerTodos = document.getElementById('btn-ver-todos');
    if(btnVerTodos) {
        btnVerTodos.addEventListener('click', () => {
            window.location.href = 'portfolios.html';
        });
    }

    // --- CALCULADORA EN TIEMPO REAL (MODAL) ---
    const investInput = document.getElementById('invest-amount');
    let calcMsg = document.getElementById('invest-calculation');
    if (!calcMsg && investInput) {
        calcMsg = document.createElement('p');
        calcMsg.id = 'invest-calculation';
        calcMsg.className = 'text-xs font-bold text-primary text-right mt-1';
        investInput.parentNode.parentNode.appendChild(calcMsg);
    }
    const btnContinue = document.querySelector('#investment-form-step1 button[type="submit"]');

    if (investInput && calcMsg) {
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (!val || val < 1000) {
                calcMsg.innerText = "Mínimo $1,000 MXN";
                calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1";
                if(btnContinue) btnContinue.disabled = true;
            } else if (val % 1000 !== 0) {
                calcMsg.innerText = "Solo múltiplos de $1,000";
                calcMsg.className = "text-xs font-bold text-orange-400 text-right mt-1";
                if(btnContinue) btnContinue.disabled = true;
            } else {
                const parts = val / 1000;
                calcMsg.innerText = `Adquiriendo ${parts} Participación${parts > 1 ? 'es' : ''}`;
                calcMsg.className = "text-xs font-bold text-emerald-500 text-right mt-1";
                if(btnContinue) btnContinue.disabled = false;
            }
        });
    }

    // --- LISTENERS FORMULARIOS ---

    // A) Inversión
    const formStep1 = document.getElementById('investment-form-step1');
    if (formStep1) {
        formStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('invest-amount').value);
            const portfolioName = investModalTitle.innerText;

            if (!amount || amount < 1000 || amount % 1000 !== 0) {
                alert("Monto inválido (Múltiplos de $1,000)");
                return;
            }

            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            if(confirmAmountDisplay) confirmAmountDisplay.innerText = formatter.format(amount);
            if(confirmPortfolioName) confirmPortfolioName.innerText = portfolioName;

            if(step1Div && step2Div) {
                step1Div.classList.add('hidden');
                step2Div.classList.remove('hidden');
                step2Div.classList.add('flex');
            }
        });
    }

    if (btnFinalConfirm) {
        btnFinalConfirm.addEventListener('click', async () => {
            const amount = document.getElementById('invest-amount').value;
            const portfolioId = investModalIdInput.value;
            
            btnFinalConfirm.disabled = true;
            btnFinalConfirm.innerText = "Procesando...";

            try {
                const response = await fetch('/api/invest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ portfolioId, amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    closeInvestModal();
                    updateUserData(token);
                    loadPortfolios();
                } else {
                    alert('Error: ' + data.message);
                    backToStep1();
                }
            } catch (error) { console.error(error); alert('Error de conexión'); backToStep1(); } 
            finally {
                btnFinalConfirm.disabled = false;
                btnFinalConfirm.innerText = "Sí, Invertir";
            }
        });
    }

    // B) y C) Depósito y Retiro
    setupTransactionForms(token);
});

// --- FUNCIONES GLOBALES ---
window.backToStep1 = function() {
    if(step1Div && step2Div) {
        step2Div.classList.add('hidden');
        step2Div.classList.remove('flex');
        step1Div.classList.remove('hidden');
    }
};

window.selectPortfolio = function(id, name) {
    if (!investModal) return;
    if(step1Div && step2Div) {
        step1Div.classList.remove('hidden');
        step2Div.classList.add('hidden');
        step2Div.classList.remove('flex');
        
        const input = document.getElementById('invest-amount');
        if(input) input.value = '';
        const calc = document.getElementById('invest-calculation');
        if(calc) calc.innerText = '';
    }
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.classList.remove('hidden');
    setTimeout(() => {
        investModal.classList.remove('opacity-0');
        investModal.querySelector('div').classList.remove('scale-95');
        investModal.querySelector('div').classList.add('scale-100');
    }, 10);
};

window.closeModal = function() { closeInvestModal(); };
function closeInvestModal() {
    if (!investModal) return;
    investModal.classList.add('opacity-0');
    setTimeout(() => { investModal.classList.add('hidden'); }, 300);
}

window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};

window.openWithdrawModal = function() { 
    if(withdrawModal) { 
        const bal = document.getElementById('display-available')?.innerText || "$0.00";
        const mb = document.getElementById('withdraw-max-balance');
        if(mb) mb.innerText = bal;
        withdrawModal.classList.remove('hidden'); 
        setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); 
    }
};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};

// --- CARGA DE DATOS ---

async function updateUserData(token) {
    try {
        const response = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
            const userData = await response.json();
            updateBalanceUI(userData);
        }
    } catch (error) { console.error("Error cargando usuario", error); }
}

function updateBalanceUI(data) {
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
    
    setText('display-net-worth', `${formatter.format(data.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    setText('display-available', formatter.format(data.availableBalance));
    setText('display-invested', formatter.format(data.investedAmount));
    setText('modal-balance-display', formatter.format(data.availableBalance));
    setText('withdraw-max-balance', formatter.format(data.availableBalance)); // Actualizar modal retiro también

    const elProfit = document.getElementById('display-profit');
    if (elProfit) {
        const sign = data.profit >= 0 ? '+' : '';
        elProfit.innerText = `${sign}${formatter.format(data.profit)}`;
        elProfit.className = data.profit < 0 ? "text-red-500 font-bold text-lg" : "text-emerald-600 dark:text-emerald-400 font-bold text-lg";
    }
}

async function loadPortfolios() {
    try {
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const gridContainer = document.getElementById('portfolio-grid');
        if(!gridContainer) return;
        
        gridContainer.innerHTML = ''; 

        // SLICE: Solo mostramos los primeros 3 en el dashboard
        portfolios.slice(0, 3).forEach(portfolio => {
            
            // --- DISEÑO CROWDFUNDING (Igual que en Portfolios.js) ---
            
            // Validar datos
            const investors = portfolio.investors || 0;
            const target = portfolio.targetInvestors || 5000;
            const spotsLeft = Math.max(0, target - investors);
            const progress = Math.min(100, (investors / target) * 100);
            
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            const numFormat = new Intl.NumberFormat('es-MX'); 

            // Colores
            let riskColorBg = portfolio.risk === 'Alto' ? 'bg-red-100 dark:bg-red-500/10' : (portfolio.risk === 'Medio' ? 'bg-orange-100 dark:bg-orange-500/10' : 'bg-green-100 dark:bg-green-500/10');
            let riskColorText = portfolio.risk === 'Alto' ? 'text-red-600 dark:text-red-400' : (portfolio.risk === 'Medio' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400');
            let riskBorder = portfolio.risk === 'Alto' ? 'border-red-200 dark:border-red-500/20' : (portfolio.risk === 'Medio' ? 'border-orange-200 dark:border-orange-500/20' : 'border-green-200 dark:border-green-500/20');
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(portfolio.id - 1) % icons.length];

            const cardHTML = `
                <div class="flex flex-col bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300 group h-full overflow-hidden">
                    
                    <div class="p-6 pb-4">
                        <div class="flex justify-between items-start mb-3">
                            <div class="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors">${icon}</div>
                            <div class="flex flex-col items-end">
                                <span class="px-2 py-1 text-[10px] uppercase font-bold rounded-full ${riskColorBg} ${riskColorText} border ${riskBorder} mb-1">Riesgo ${portfolio.risk}</span>
                                <span class="text-[10px] text-slate-400 font-medium">Lock-up: ${portfolio.lockUpPeriod}</span>
                            </div>
                        </div>
                        <h3 class="text-slate-900 dark:text-white text-lg font-bold mb-1 leading-tight">${portfolio.name}</h3>
                        <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mb-4">${portfolio.provider}</p>
                        
                        <div class="flex items-center gap-2 mb-2">
                            <span class="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span class="text-xs font-bold text-green-600 dark:text-green-400">${numFormat.format(spotsLeft)} cupos disp.</span>
                        </div>
                    </div>

                    <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-b border-slate-100 dark:border-slate-700">
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-700 dark:text-white">Progreso</span>
                            <span class="text-primary">${progress.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-2">
                            <div class="bg-primary h-2.5 rounded-full transition-all duration-1000" style="width: ${progress}%"></div>
                        </div>
                        <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <span>${numFormat.format(investors)} socios</span>
                            <span>Meta: ${numFormat.format(target)}</span>
                        </div>
                    </div>

                    <div class="p-6 pt-4 mt-auto">
                        <div class="flex items-center justify-between mb-4">
                             <div class="flex flex-col">
                                <span class="text-xs text-slate-400">Rend. Histórico</span>
                                <span class="text-lg font-bold text-green-500">+${portfolio.returnYTD}%</span>
                             </div>
                             <div class="flex flex-col text-right">
                                <span class="text-xs text-slate-400">Ticket</span>
                                <span class="text-sm font-bold text-slate-900 dark:text-white">${formatter.format(portfolio.minInvestment)}</span>
                             </div>
                        </div>
                        
                        <button onclick="selectPortfolio(${portfolio.id}, '${portfolio.name}')" class="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none flex items-center justify-center gap-2">
                            <span>Unirme al Grupo</span>
                            <span class="material-symbols-outlined text-sm">group_add</span>
                        </button>
                    </div>
                </div>
            `;
            gridContainer.innerHTML += cardHTML;
        });
    } catch (error) { console.error(error); }
}

function renderMarketChart() {
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;

    try {
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const lineColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';

        // Llamada API (Misma que tenías)
        fetch('/api/market').then(res => res.json()).then(marketData => {
             const labels = marketData.dates.map(ts => new Date(ts*1000).toLocaleDateString('es-MX', {month:'short', day:'numeric'}));
             
             new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'S&P 500',
                        data: marketData.prices,
                        borderColor: '#307de8',
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                            gradient.addColorStop(0, 'rgba(48, 125, 232, 0.2)');
                            gradient.addColorStop(1, 'rgba(48, 125, 232, 0)');
                            return gradient;
                        },
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }]
                },
                plugins: [{
                    id: 'verticalHoverLine',
                    afterDatasetsDraw: (chart) => {
                        if (chart.tooltip?._active?.length) {
                            const x = chart.tooltip._active[0].element.x;
                            const yAxis = chart.scales.y;
                            const ctx = chart.ctx;
                            ctx.save();
                            ctx.beginPath();
                            ctx.moveTo(x, yAxis.top);
                            ctx.lineTo(x, yAxis.bottom);
                            ctx.lineWidth = 1;
                            ctx.strokeStyle = lineColor;
                            ctx.setLineDash([5, 5]);
                            ctx.stroke();
                            ctx.restore();
                        }
                    }
                }],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                    interaction: { mode: 'index', intersect: false },
                    hover: { mode: 'index', intersect: false },
                    scales: {
                        y: { grid: { color: gridColor, borderDash: [5, 5] }, ticks: { color: textColor, callback: (v) => '$' + v }, border: { display: false } },
                        x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 6 }, border: { display: false } }
                    }
                }
            });
        });
    } catch (e) { console.error("Error renderizando gráfica:", e); }
}

function setupTransactionForms(token) {
    // Helpers para depósitos y retiros
    const depositForm = document.getElementById('deposit-form');
    if (depositForm) {
        depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('deposit-amount').value;
            const btn = document.getElementById('btn-confirm-deposit');
            const originalText = btn.innerText;
            btn.disabled = true; btn.innerText = "Procesando...";
            await new Promise(r => setTimeout(r, 1000)); 
            try {
                const res = await fetch('/api/deposit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ amount, token })
                });
                if (res.ok) {
                    closeDepositModal();
                    updateUserData(token);
                    document.getElementById('deposit-amount').value = '';
                    const c = document.getElementById('card-number'); if(c) c.value='';
                } else { const d = await res.json(); alert(d.message); }
            } catch (e) { alert('Error'); } finally { btn.disabled = false; btn.innerText = originalText; }
        });
    }

    const withdrawForm = document.getElementById('withdraw-form');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('withdraw-amount').value;
            const btn = document.getElementById('btn-confirm-withdraw');
            const originalText = btn.innerText;
            btn.disabled = true; btn.innerText = "Enviando...";
            await new Promise(r => setTimeout(r, 1000)); 
            try {
                const res = await fetch('/api/withdraw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ amount, token })
                });
                if (res.ok) {
                    closeWithdrawModal();
                    updateUserData(token);
                    document.getElementById('withdraw-amount').value = '';
                } else { const d = await res.json(); alert(d.message); }
            } catch (e) { alert('Error'); } finally { btn.disabled = false; btn.innerText = originalText; }
        });
    }
}