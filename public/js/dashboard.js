// public/js/dashboard.js
let investModal, depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // INICIALIZAR REFERENCIAS
    investModal = document.getElementById('invest-modal');
    successModal = document.getElementById('success-modal');
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
    const btnContinue = document.getElementById('btn-continue-invest');

    if (investInput) {
        if (!calcMsg) { calcMsg = document.createElement('p'); calcMsg.id = 'invest-calculation'; calcMsg.className = 'text-xs font-bold text-primary text-right mt-1'; investInput.parentNode.appendChild(calcMsg); }
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const min = parseInt(investModal.dataset.ticket || 1000);
            if (!val || val < min) { calcMsg.innerText = `Mínimo $${min.toLocaleString()}`; calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1"; if(btnContinue) btnContinue.disabled = true; }
            else if (val % min !== 0) { calcMsg.innerText = `Múltiplos de $${min.toLocaleString()}`; calcMsg.className = "text-xs font-bold text-orange-400 text-right mt-1"; if(btnContinue) btnContinue.disabled = true; }
            else { const p = val/min; calcMsg.innerText = `Adquiriendo ${p} Cupo${p>1?'s':''}`; calcMsg.className = "text-xs font-bold text-emerald-500 text-right mt-1"; if(btnContinue) btnContinue.disabled = false; }
        });
    }

    // CARGA DATOS
    await updateUserData(token);
    await loadPortfolios();
    renderMarketChart();

    document.getElementById('btn-ver-todos')?.addEventListener('click', () => window.location.href = 'portfolios.html');
    setupFormListeners(token);
});

// CARGA PORTAFOLIOS
async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios?t=' + Date.now());
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        data.slice(0, 3).forEach(p => {
            const investors = p.investors || 0;
            const target = p.targetInvestors || 5000;
            const remaining = (p.remainingTickets !== undefined) ? p.remainingTickets : 1000;
            const progress = Math.min(100, ((target - remaining) / target) * 100);
            const numFormat = new Intl.NumberFormat('es-MX');
            const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

            // Semáforo
            let badgeColor = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            let dotColor = "bg-green-500";
            let statusText = `${numFormat.format(remaining)} cupos disp.`;
            let disabled = "";
            let btnText = "Unirme al Grupo";

            if (remaining === 0) { badgeColor = "bg-slate-200 text-slate-500"; dotColor = "hidden"; statusText = "AGOTADO"; disabled = "disabled"; btnText = "Cerrado"; }
            else if (progress >= 90) { badgeColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"; dotColor = "bg-red-500"; statusText = `¡Últimos ${remaining} cupos!`; }

            const icon = ['🚀','💻','🌍','🌱','💎'][p.id % 5] || '📈';
            const color = p.risk === 'Alto' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50';

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300">
                <div class="flex justify-between mb-3 items-start">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">${icon}</div>
                    <div class="flex flex-col items-end"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}">${p.risk}</span><span class="text-[10px] text-slate-400 mt-1">Lock: ${p.lockUpPeriod}</span></div>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2 h-8">${p.description}</p>
                <div class="flex items-center gap-2 mb-4">
                    <span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${badgeColor}"><span class="flex h-2 w-2 rounded-full ${dotColor} animate-pulse"></span>${statusText}</span>
                </div>
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Progreso</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width: ${progress}%"></div></div>
                    <div class="flex justify-between text-[10px] text-slate-400 mb-4 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                         <div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold text-slate-900 dark:text-white">${moneyFmt.format(p.minInvestment)}</span></div>
                         <button onclick="setupInvest(${p.id}, '${p.name}', ${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50" ${disabled}>${btnText}</button>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

// GRÁFICA (SENSIBLE)
function renderMarketChart() {
    const ctx = document.getElementById('marketChart'); if(!ctx) return;
    fetch('/api/market').then(r=>r.json()).then(d=>{
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        new Chart(ctx, {
            type: 'line',
            data: { labels: d.dates.map(t=>new Date(t*1000).toLocaleDateString('es-MX')), datasets: [{ data:d.prices, borderColor:'#307de8', borderWidth:2, pointRadius:0, pointHitRadius: 20, hoverBackgroundColor: '#fff' }] },
            options: { 
                maintainAspectRatio:false, 
                interaction: {mode:'index', intersect:false}, 
                plugins:{legend:{display:false}, tooltip:{enabled:true, mode:'index', intersect:false}},
                scales:{ y:{grid:{color:gridColor}, ticks:{color:textColor}}, x:{display:false} } 
            }
        });
    }).catch(e=>{});
}

// LISTENERS FORMULARIOS
function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if(!amount || amount < min || amount % min !== 0) return;
        
        document.getElementById('confirm-amount-display').innerText = new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        
        // Cambiar paso asegurando visibilidad
        const s1 = document.getElementById('invest-step-1');
        const s2 = document.getElementById('invest-step-2');
        s1.classList.add('hidden'); s2.classList.remove('hidden');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        const pid = investModalIdInput.value;
        const amount = document.getElementById('invest-amount').value;
        try {
            const res = await fetch('/api/invest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ portfolioId: pid, amount, token }) });
            const d = await res.json();
            if(res.ok) { 
                closeModal(); updateUserData(token); loadPortfolios(); showSuccess();
            } else { alert(d.message); backToStep1(); }
        } catch(e) { alert("Error de red"); backToStep1(); }
        btnFinalConfirm.innerText = "Confirmar";
    });

    // Deps/Ret (Simplificado)
    const dep = document.getElementById('deposit-form'); if(dep) dep.addEventListener('submit', async(e)=>{ e.preventDefault(); const a=document.getElementById('deposit-amount').value; try{ await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount:a,token})}); closeDepositModal(); updateUserData(token); document.getElementById('deposit-amount').value=''; alert("Depósito OK"); }catch(e){} });
    const wit = document.getElementById('withdraw-form'); if(wit) wit.addEventListener('submit', async(e)=>{ e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{ await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount:a,token})}); closeWithdrawModal(); updateUserData(token); document.getElementById('withdraw-amount').value=''; alert("Retiro OK"); }catch(e){} });
}

// GLOBALES & HELPERS
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.innerHTML = v; };
    set('display-net-worth', `${fmt.format(d.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    set('display-available', fmt.format(d.availableBalance));
    set('display-invested', fmt.format(d.investedAmount));
    set('modal-balance-display', fmt.format(d.availableBalance));
    set('withdraw-max-balance', fmt.format(d.availableBalance));
    const p = document.getElementById('display-profit'); if(p) { p.innerText = (d.profit >= 0 ? '+' : '') + fmt.format(d.profit); p.className = d.profit >= 0 ? "text-emerald-500 font-bold text-lg" : "text-red-500 font-bold text-lg"; }
}

window.setupInvest = function(id, name, ticket) {
    if(!investModal) return;
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.dataset.ticket = ticket;
    backToStep1();
    investModal.classList.remove('hidden'); setTimeout(() => { investModal.classList.remove('opacity-0'); investModal.querySelector('div').classList.add('scale-100'); }, 10);
    const inp = document.getElementById('invest-amount'); if(inp) { inp.value = ''; inp.placeholder = `Ej. ${ticket}`; inp.step = ticket; inp.min = ticket; }
    const msg = document.getElementById('invest-calculation'); if(msg) { msg.innerText = `Mínimo $${ticket}`; msg.className = "text-xs font-bold text-primary text-right mt-1"; }
}
window.backToStep1 = function() { const s1=document.getElementById('invest-step-1'), s2=document.getElementById('invest-step-2'); if(s1 && s2){ s1.classList.remove('hidden'); s2.classList.add('hidden'); } }
window.closeModal = function() { if(investModal) { investModal.classList.add('opacity-0'); investModal.querySelector('div').classList.remove('scale-100'); setTimeout(() => investModal.classList.add('hidden'), 300); } }
window.showSuccess = function() { if(successModal) { successModal.classList.remove('hidden'); setTimeout(() => { successModal.classList.remove('opacity-0'); successModal.querySelector('div').classList.add('scale-100'); }, 10); } }
window.closeSuccessModal = function() { if(successModal) { successModal.classList.add('opacity-0'); setTimeout(() => successModal.classList.add('hidden'), 300); } }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { const b = document.getElementById('modal-balance-display')?.innerText || "0"; document.getElementById('withdraw-max-balance').innerText = b; withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};