// public/js/dashboard.js
let investModal, step1Div, step2Div, btnFinalConfirm;
let depositModal, withdrawModal;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Refs
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

    // Calculadora Modal
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

    // Carga Inicial
    await updateUserData(token);
    loadPortfolios();
    renderMarketChart();

    // Listeners
    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');

    setupTransactionForms(token);
    setupInvestmentForm(token);
});

// FUNCIONES CARGA
async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        // MOSTRAR SOLO LOS PRIMEROS 3
        data.slice(0, 3).forEach(p => {
            // Cálculo Cupos
            const ticket = p.minInvestment || 1000;
            const targetMoney = p.targetAmount || 1000000;
            const currentMoney = p.currentAmount || 0;
            
            const totalSlots = Math.floor(targetMoney / ticket);
            const filledSlots = Math.floor(currentMoney / ticket);
            const spotsLeft = Math.max(0, totalSlots - filledSlots);
            const progress = Math.min(100, (currentMoney / targetMoney) * 100);

            const numFormat = new Intl.NumberFormat('es-MX');
            const moneyFormat = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

            const html = `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full">
                <div class="flex justify-between mb-3">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">🚀</div>
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-600">${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2">${p.description}</p>
                
                <div class="flex items-center gap-2 mb-4">
                    <span class="flex h-2 w-2 rounded-full ${spotsLeft > 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse"></span>
                    <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${numFormat.format(spotsLeft)} cupos disp.</span>
                </div>

                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1">
                        <span class="text-slate-500">Meta</span>
                        <span class="text-primary">${progress.toFixed(0)}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1">
                        <div class="bg-primary h-2 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] text-slate-400 mb-4">
                        <span>${moneyFormat.format(currentMoney)}</span>
                        <span>${moneyFormat.format(targetMoney)}</span>
                    </div>
                    <button onclick="setupInvest(${p.id}, '${p.name}')" class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity">Unirme al Grupo</button>
                </div>
            </div>`;
            grid.innerHTML += html;
        });
    } catch(e) { console.error(e); }
}

// HELPERS
async function updateUserData(token) {
    try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) updateBalanceUI(await res.json());
    } catch(e) { console.error(e); }
}

function updateBalanceUI(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
    setText('display-net-worth', `${fmt.format(data.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    setText('display-available', fmt.format(data.availableBalance));
    setText('display-invested', fmt.format(data.investedAmount));
    setText('modal-balance-display', fmt.format(data.availableBalance));
    setText('withdraw-max-balance', fmt.format(data.availableBalance));
}

function setupInvestmentForm(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        if(!amount || amount < 1000 || amount % 1000 !== 0) return;
        
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
        document.getElementById('confirm-amount-display').innerText = fmt.format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        
        step1Div.classList.add('hidden');
        step2Div.classList.remove('hidden');
        step2Div.classList.add('flex');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        const pid = document.getElementById('modal-portfolio-id').value;
        const amount = document.getElementById('invest-amount').value;
        try {
            const res = await fetch('/api/invest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ portfolioId: pid, amount, token })
            });
            const d = await res.json();
            if(res.ok) {
                closeModal();
                updateUserData(token);
                loadPortfolios();
            } else {
                alert(d.message);
                backToStep1();
            }
        } catch(e) { alert("Error"); backToStep1(); }
        btnFinalConfirm.innerText = "Sí, Invertir";
    });
}

function renderMarketChart() { /* Tu código de gráfica Chart.js que ya funciona */ 
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    fetch('/api/market').then(res => res.json()).then(data => {
        const labels = data.dates.map(ts => new Date(ts*1000).toLocaleDateString('es-MX', {month:'short', day:'numeric'}));
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data.prices,
                    borderColor: '#307de8',
                    backgroundColor: (ctx) => {
                        const g = ctx.chart.ctx.createLinearGradient(0,0,0,200);
                        g.addColorStop(0, 'rgba(48, 125, 232, 0.2)'); g.addColorStop(1, 'rgba(48, 125, 232, 0)');
                        return g;
                    },
                    borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0, pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { grid: { color: gridColor, borderDash: [5,5] }, ticks: { color: textColor, callback: v => '$'+v }, border: { display: false } },
                    x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 6 }, border: { display: false } }
                }
            }
        });
    });
}

// GLOBAL HELPERS
window.setupInvest = function(id, name) {
    if(!investModal) return;
    document.getElementById('modal-portfolio-name').innerText = name;
    document.getElementById('modal-portfolio-id').value = id;
    backToStep1();
    investModal.classList.remove('hidden');
    setTimeout(() => investModal.classList.remove('opacity-0'), 10);
    const inp = document.getElementById('invest-amount'); if(inp) inp.value = '';
    const msg = document.getElementById('invest-calculation'); if(msg) msg.innerText = '';
}
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); step2Div.classList.remove('flex'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
// ... (Aquí pegas las funciones de openDepositModal, closeDepositModal, etc. para no repetir mucho código) ...
window.openDepositModal = function() { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }
window.closeDepositModal = function() { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }
window.openWithdrawModal = function() { 
    const b = document.getElementById('display-available')?.innerText || "0";
    document.getElementById('withdraw-max-balance').innerText = b;
    withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); 
}
window.closeWithdrawModal = function() { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }

function setupTransactionForms(token) { /* Tu código de depósitos/retiros igual que siempre */ 
    const depositForm = document.getElementById('deposit-form');
    if (depositForm) {
        depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('deposit-amount').value;
            const btn = document.getElementById('btn-confirm-deposit');
            btn.disabled = true; btn.innerText = "Procesando...";
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
                } else { const d = await res.json(); alert(d.message); }
            } catch (e) { alert('Error'); } finally { btn.disabled = false; btn.innerText = "Pagar Ahora"; }
        });
    }
    const withdrawForm = document.getElementById('withdraw-form');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('withdraw-amount').value;
            const btn = document.getElementById('btn-confirm-withdraw');
            btn.disabled = true; btn.innerText = "Enviando...";
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
            } catch (e) { alert('Error'); } finally { btn.disabled = false; btn.innerText = "Confirmar Retiro"; }
        });
    }
}