// public/js/dashboard.js - VERSIÓN CON CALCULADORA

// --- VARIABLES GLOBALES ---
let investModal, investModalTitle, investModalIdInput;
let depositModal, withdrawModal;
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. REFERENCIAS
    investModal = document.getElementById('invest-modal');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');

    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // --- CALCULADORA DE INVERSIÓN (Lógica de Portfolios) ---
    const investInput = document.getElementById('invest-amount');
    const calcMsg = document.getElementById('invest-calculation');
    const btnContinue = document.getElementById('btn-continue-invest');

    if (investInput && calcMsg) {
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (!val || val < 1000) {
                calcMsg.innerText = "Mínimo $1,000 MXN";
                calcMsg.className = "text-xs font-bold text-red-400 text-right";
                if(btnContinue) btnContinue.disabled = true;
            } else if (val % 1000 !== 0) {
                calcMsg.innerText = "Solo múltiplos de $1,000";
                calcMsg.className = "text-xs font-bold text-orange-400 text-right";
                if(btnContinue) btnContinue.disabled = true;
            } else {
                const parts = val / 1000;
                calcMsg.innerText = `Adquiriendo ${parts} Participación${parts > 1 ? 'es' : ''}`;
                calcMsg.className = "text-xs font-bold text-emerald-500 text-right";
                if(btnContinue) btnContinue.disabled = false;
            }
        });
    }

    // --- TARJETA Y FECHA ---
    const cardInput = document.getElementById('card-number');
    if (cardInput) {
        cardInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            value = value.substring(0, 16);
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }
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
    if (!token) { window.location.href = '/login.html'; return; }

    // 2. CARGAR DATOS
    await updateUserData(token);
    loadPortfolios();
    renderMarketChart();

    const btnVerTodos = document.getElementById('btn-ver-todos');
    if(btnVerTodos) btnVerTodos.addEventListener('click', () => window.location.href = 'portfolios.html');

    // --- LISTENERS ---
    const formStep1 = document.getElementById('investment-form-step1');
    if (formStep1) {
        formStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('invest-amount').value);
            const portfolioName = investModalTitle.innerText;

            if (!amount || amount < 1000 || amount % 1000 !== 0) return; // Validación ya hecha visualmente

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
            btnFinalConfirm.disabled = true; btnFinalConfirm.innerText = "Procesando...";

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
                } else { alert('Error: ' + data.message); backToStep1(); }
            } catch (error) { alert('Error de conexión'); backToStep1(); } 
            finally { btnFinalConfirm.disabled = false; btnFinalConfirm.innerText = "Sí, Invertir"; }
        });
    }

    // Depósito y Retiro
    setupTransactionForms(token);
});

// --- FUNCIONES GLOBALES ---
window.backToStep1 = function() {
    if(step1Div && step2Div) { step2Div.classList.add('hidden'); step2Div.classList.remove('flex'); step1Div.classList.remove('hidden'); }
};

window.selectPortfolio = function(id, name) {
    if (!investModal) return;
    if(step1Div && step2Div) {
        step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); step2Div.classList.remove('flex');
        const input = document.getElementById('invest-amount'); if(input) input.value = '';
        const calc = document.getElementById('invest-calculation'); if(calc) { calc.innerText = "Ingresa un monto (Mín. $1,000)"; calc.className = "text-xs font-bold text-primary text-right"; }
        const btn = document.getElementById('btn-continue-invest'); if(btn) btn.disabled = true;
    }
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.classList.remove('hidden');
    setTimeout(() => { investModal.classList.remove('opacity-0'); investModal.querySelector('div').classList.remove('scale-95'); investModal.querySelector('div').classList.add('scale-100'); }, 10);
};
window.closeModal = function() { closeInvestModal(); };
function closeInvestModal() {
    if (!investModal) return;
    investModal.classList.add('opacity-0');
    setTimeout(() => { investModal.classList.add('hidden'); }, 300);
}
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { 
    const bal = document.getElementById('display-available')?.innerText || "$0.00";
    const mb = document.getElementById('withdraw-max-balance'); if(mb) mb.innerText = bal;
    withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); 
}};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};

// --- CARGA DATOS ---
async function updateUserData(token) {
    try {
        const response = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) { const d = await response.json(); updateBalanceUI(d); }
    } catch (e) { console.error(e); }
}
function updateBalanceUI(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
    setText('display-net-worth', `${fmt.format(data.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    setText('display-available', fmt.format(data.availableBalance));
    setText('display-invested', fmt.format(data.investedAmount));
    setText('modal-balance-display', fmt.format(data.availableBalance));
    setText('withdraw-max-balance', fmt.format(data.availableBalance));
    const elProf = document.getElementById('display-profit');
    if (elProf) {
        elProf.innerText = (data.profit >= 0 ? '+' : '') + fmt.format(data.profit);
        elProf.className = data.profit >= 0 ? "text-emerald-500 font-bold text-lg" : "text-red-500 font-bold text-lg";
    }
}

async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        data.slice(0, 3).forEach(p => {
            // ARREGLO NaN: Usar valores seguros
            const investors = p.currentInvestors || 0;
            const target = p.targetInvestors || 1000;
            const progress = Math.min(100, (investors / target) * 100);
            const spotsLeft = Math.max(0, target - investors);
            
            const fmt = new Intl.NumberFormat('es-MX');
            
            // Colores Riesgo
            let color = p.risk === 'Alto' ? 'text-red-500 bg-red-50' : (p.risk === 'Bajo' ? 'text-green-500 bg-green-50' : 'text-orange-500 bg-orange-50');
            
            const html = `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full">
                <div class="flex justify-between mb-3">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">🚀</div>
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${color}">${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2">${p.description}</p>
                
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1">
                        <span class="text-slate-500">Progreso</span>
                        <span class="text-primary">${progress.toFixed(0)}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1">
                        <div class="bg-primary h-2 rounded-full transition-all duration-1000" style="width: ${progress}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] text-slate-400 mb-4">
                        <span>${fmt.format(investors)} socios</span>
                        <span>${fmt.format(spotsLeft)} cupos</span>
                    </div>
                    <button onclick="selectPortfolio(${p.id}, '${p.name}')" class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity">Unirme al Grupo</button>
                </div>
            </div>`;
            grid.innerHTML += html;
        });
    } catch(e) { console.error(e); }
}

function renderMarketChart() { /* (Mismo código de siempre) */
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;
    // ... (Tu código de gráfica se mantiene igual, no lo borres)
    // Para ahorrar espacio aquí, asumo que lo tienes. Si lo necesitas, pídemelo.
    // Pega aquí el fetch('/api/market') y new Chart() que tenías antes.
    try {
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#94a3b8' : '#64748b';
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
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        y: { grid: { color: gridColor, borderDash: [5, 5] }, ticks: { color: textColor, callback: (v) => '$' + v }, border: { display: false } },
                        x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 6 }, border: { display: false } }
                    }
                }
            });
        });
    } catch (e) { console.error(e); }
}

function setupTransactionForms(token) {
    // (Mismo código de depósitos y retiros que ya tenías)
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