// public/js/dashboard.js
let investModal, depositModal, withdrawModal;
let step1Div, step2Div, btnFinalConfirm, investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // INIT REFS
    investModal = document.getElementById('invest-modal');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    btnFinalConfirm = document.getElementById('btn-final-confirm');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');

    // INIT CALCULADORA INPUT
    const investInput = document.getElementById('invest-amount');
    let calcMsg = document.getElementById('invest-calculation');
    const btnContinue = document.getElementById('btn-continue-invest');

    if (investInput && calcMsg) {
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (!val || val < 1000) {
                calcMsg.innerText = "Mínimo $1,000";
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

    // INIT HELPERS
    const cardInput = document.getElementById('card-number');
    if (cardInput) cardInput.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').substring(0,16).match(/.{1,4}/g)?.join(' ') || e.target.value; });
    const expiryInput = document.getElementById('card-expiry');
    if (expiryInput) expiryInput.addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g, ''); if(v.length>2) v=v.substring(0,2)+'/'+v.substring(2,4); e.target.value = v; });

    // CARGAR DATOS
    await updateUserData(token);
    loadPortfolios();
    renderMarketChart();

    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');

    // FORMULARIOS
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        if(!amount || amount < 1000 || amount % 1000 !== 0) return;
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
        confirmAmountDisplay.innerText = fmt.format(amount);
        confirmPortfolioName.innerText = investModalTitle.innerText;
        step1Div.classList.add('hidden'); step2Div.classList.remove('hidden'); step2Div.classList.add('flex');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        try {
            const res = await fetch('/api/invest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ portfolioId: investModalIdInput.value, amount: document.getElementById('invest-amount').value, token })
            });
            const data = await response.json();
            if(res.ok) { closeInvestModal(); updateUserData(token); loadPortfolios(); } 
            else { alert(data.message); backToStep1(); }
        } catch(e) { alert("Error"); backToStep1(); }
        btnFinalConfirm.innerText = "Sí, Invertir";
    });

    setupTxForms(token);
});

async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        // SLICE (Solo 3)
        data.slice(0, 3).forEach(p => {
            const investors = p.currentInvestors || 0;
            const target = p.targetInvestors || 5000;
            const spotsLeft = Math.max(0, target - investors);
            const progress = Math.min(100, (investors / target) * 100);
            const fmt = new Intl.NumberFormat('es-MX');
            
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(p.id - 1) % icons.length];
            let color = p.risk === 'Alto' ? 'bg-red-100 text-red-600' : (p.risk === 'Bajo' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600');

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full">
                <div class="flex justify-between mb-3">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">${icon}</div>
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${color}">Riesgo ${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2">${p.description}</p>
                <div class="flex items-center gap-2 mb-4">
                    <span class="flex h-2 w-2 rounded-full ${spotsLeft>0?'bg-green-500':'bg-red-500'} animate-pulse"></span>
                    <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${fmt.format(spotsLeft)} cupos disp.</span>
                </div>
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Progreso</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-4"><div class="bg-primary h-2 rounded-full" style="width: ${progress}%"></div></div>
                    <button onclick="setupInvest(${p.id}, '${p.name}')" class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity">Unirme al Grupo</button>
                </div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

// HELPERS (Mismos que antes)
async function updateUserData(token) { try { const r = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(data) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
    set('display-net-worth', `${fmt.format(data.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    set('display-available', fmt.format(data.availableBalance));
    set('display-invested', fmt.format(data.investedAmount));
    set('modal-balance-display', fmt.format(data.availableBalance));
    set('withdraw-max-balance', fmt.format(data.availableBalance));
    const p = document.getElementById('display-profit');
    if(p) { p.innerText = (data.profit >= 0 ? '+' : '') + fmt.format(data.profit); p.className = data.profit >= 0 ? "text-emerald-500 font-bold text-lg" : "text-red-500 font-bold text-lg"; }
}
function renderMarketChart() { /* Mismo código Chart.js de siempre */ 
    const ctx = document.getElementById('marketChart');
    if(!ctx) return;
    try {
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        fetch('/api/market').then(r=>r.json()).then(d=>{
            new Chart(ctx, { type: 'line', data: { labels: d.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX')), datasets: [{ label:'S&P 500', data:d.prices, borderColor:'#307de8', borderWidth:2, pointRadius:0 }] }, options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{display:false},y:{grid:{color:gridColor},ticks:{color:textColor}}} } });
        });
    } catch(e){}
}
function setupTxForms(token) {
    const dep = document.getElementById('deposit-form'); if(dep) dep.addEventListener('submit', async(e)=>{ e.preventDefault(); const amount=document.getElementById('deposit-amount').value; try{ const r=await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount,token})}); if(r.ok){closeDepositModal(); updateUserData(token); document.getElementById('deposit-amount').value='';} }catch(e){} });
    const wit = document.getElementById('withdraw-form'); if(wit) wit.addEventListener('submit', async(e)=>{ e.preventDefault(); const amount=document.getElementById('withdraw-amount').value; try{ const r=await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount,token})}); if(r.ok){closeWithdrawModal(); updateUserData(token); document.getElementById('withdraw-amount').value='';} }catch(e){} });
}
window.setupInvest = function(id, name) {
    if(!investModal) return;
    document.getElementById('modal-portfolio-name').innerText = name;
    document.getElementById('modal-portfolio-id').value = id;
    backToStep1();
    investModal.classList.remove('hidden'); setTimeout(() => investModal.classList.remove('opacity-0'), 10);
    const inp = document.getElementById('invest-amount'); if(inp) inp.value = '';
    const msg = document.getElementById('invest-calculation'); if(msg) msg.innerText = '';
}
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { 
    if(withdrawModal) { 
        const b = document.getElementById('display-available')?.innerText || "0";
        document.getElementById('withdraw-max-balance').innerText = b;
        withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); 
    }
};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};