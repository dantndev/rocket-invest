// public/js/dashboard.js
let investModal, depositModal, withdrawModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // REFERENCIAS
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

    // CALCULADORA
    const investInput = document.getElementById('invest-amount');
    let calcMsg = document.getElementById('invest-calculation');
    if (!calcMsg && investInput) {
        calcMsg = document.createElement('p');
        calcMsg.id = 'invest-calculation';
        calcMsg.className = 'text-xs font-bold text-primary text-right mt-1';
        investInput.parentNode.parentNode.appendChild(calcMsg);
    }
    const btnContinue = document.querySelector('#investment-form-step1 button[type="submit"]');
    if (investInput) investInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (!val || val < 1000) { calcMsg.innerText = "Mínimo $1,000"; calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1"; if(btnContinue) btnContinue.disabled = true; }
        else if (val % 1000 !== 0) { calcMsg.innerText = "Solo múltiplos de $1,000"; calcMsg.className = "text-xs font-bold text-orange-400 text-right mt-1"; if(btnContinue) btnContinue.disabled = true; }
        else { const p = val/1000; calcMsg.innerText = `${p} Participación${p>1?'es':''}`; calcMsg.className = "text-xs font-bold text-emerald-500 text-right mt-1"; if(btnContinue) btnContinue.disabled = false; }
    });

    // INIT
    await updateUserData(token);
    loadPortfolios();
    renderMarketChart();
    
    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');
    
    setupForms(token);
});

// CARGA
async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        data.slice(0, 3).forEach(p => {
            // VALORES SEGUROS (Evita NaN)
            const investors = p.investors || 0; 
            const target = p.targetInvestors || 5000;
            const progress = Math.min(100, (investors / target) * 100);
            const spotsLeft = Math.max(0, target - investors);
            const numFormat = new Intl.NumberFormat('es-MX');
            const moneyFormat = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            let color = p.risk === 'Alto' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600';
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(p.id - 1) % icons.length] || '📈';

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full">
                <div class="flex justify-between mb-3">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">${icon}</div>
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${color}">${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2">${p.description}</p>
                <div class="flex items-center gap-2 mb-4">
                    <span class="flex h-2 w-2 rounded-full ${spotsLeft>0?'bg-green-500':'bg-red-500'} animate-pulse"></span>
                    <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${numFormat.format(spotsLeft)} cupos disp.</span>
                </div>
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Progreso</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width: ${progress}%"></div></div>
                    <div class="flex justify-between text-[10px] text-slate-400 mb-4"><span>${numFormat.format(investors)} socios</span><span>Meta: ${numFormat.format(target)}</span></div>
                    <button onclick="setupInvest(${p.id}, '${p.name}')" class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity">Unirme al Grupo</button>
                </div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

// HELPERS
async function updateUserData(token) { try { const r = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.innerHTML = v; };
    set('display-net-worth', `${fmt.format(d.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    set('display-available', fmt.format(d.availableBalance));
    set('display-invested', fmt.format(d.investedAmount));
    set('modal-balance-display', fmt.format(d.availableBalance));
    set('withdraw-max-balance', fmt.format(d.availableBalance));
    const prof = document.getElementById('display-profit');
    if(prof) { prof.innerText = (d.profit>=0?'+':'') + fmt.format(d.profit); prof.className = d.profit>=0 ? "text-emerald-500 font-bold text-lg" : "text-red-500 font-bold text-lg"; }
}

function setupForms(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        if(!amount || amount < 1000 || amount % 1000 !== 0) return;
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
        document.getElementById('confirm-amount-display').innerText = fmt.format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        step1Div.classList.add('hidden'); step2Div.classList.remove('hidden'); step2Div.classList.add('flex');
    });
    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        try {
            const res = await fetch('/api/invest', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ portfolioId: investModalIdInput.value, amount: document.getElementById('invest-amount').value, token }) });
            if(res.ok) { closeInvestModal(); updateUserData(token); loadPortfolios(); } else { const d = await res.json(); alert(d.message); backToStep1(); }
        } catch(e) { alert("Error"); backToStep1(); }
        btnFinalConfirm.innerText = "Sí, Invertir";
    });
    // Deps/Ret
    const dep = document.getElementById('deposit-form'); if(dep) dep.addEventListener('submit', async(e)=>{ e.preventDefault(); const amount=document.getElementById('deposit-amount').value; const btn=document.getElementById('btn-confirm-deposit'); btn.disabled=true; try{ const r=await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount,token})}); if(r.ok){closeDepositModal(); updateUserData(token); document.getElementById('deposit-amount').value='';} }catch(e){} finally{btn.disabled=false;} });
    const wit = document.getElementById('withdraw-form'); if(wit) wit.addEventListener('submit', async(e)=>{ e.preventDefault(); const amount=document.getElementById('withdraw-amount').value; const btn=document.getElementById('btn-confirm-withdraw'); btn.disabled=true; try{ const r=await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount,token})}); if(r.ok){closeWithdrawModal(); updateUserData(token); document.getElementById('withdraw-amount').value='';} }catch(e){} finally{btn.disabled=false;} });
}

// GLOBALES
window.setupInvest = function(id, name) { if(!investModal) return; investModalTitle.innerText = name; investModalIdInput.value = id; backToStep1(); investModal.classList.remove('hidden'); setTimeout(() => investModal.classList.remove('opacity-0'), 10); const inp = document.getElementById('invest-amount'); if(inp) inp.value = ''; const msg = document.getElementById('invest-calculation'); if(msg) msg.innerText = ''; }
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { const b = document.getElementById('display-available')?.innerText || "0"; document.getElementById('withdraw-max-balance').innerText = b; withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};
function renderMarketChart() { /* Tu código Chart.js aquí (omitido por espacio, pero úsalo) */ 
    const ctx = document.getElementById('marketChart'); if(!ctx) return;
    try {
        const isDark = document.documentElement.classList.contains('dark'); const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'; const textColor = isDark ? '#94a3b8' : '#64748b';
        fetch('/api/market').then(r=>r.json()).then(d=>{
            new Chart(ctx, { type: 'line', data: { labels: d.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX')), datasets: [{ data: d.prices, borderColor: '#307de8', borderWidth: 2, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display:false} }, scales: { y: { grid: {color:gridColor}, ticks: {color:textColor} }, x: { display:false } } } });
        });
    } catch(e){}
}