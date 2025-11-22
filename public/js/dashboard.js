// public/js/dashboard.js

// --- VARIABLES GLOBALES ---
let investModal, depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;
let myChart, chartDataCache;

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // 1. REFERENCIAS DOM (Blindadas)
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

    // 2. CALCULADORA (Solo si existe el input)
    initCalculator();

    // 3. CARGA DE DATOS (En paralelo para velocidad)
    // Usamos Promise.allSettled para que si uno falla, el otro siga
    await Promise.allSettled([
        updateUserData(token),
        loadPortfolios(),
        fetchPersonalChart(token, 'netWorth')
    ]);

    // 4. LISTENERS
    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');

    setupFormListeners(token);
    setupExtraInputs();
});

// --- CALCULADORA ---
function initCalculator() {
    const investInput = document.getElementById('invest-amount');
    if (!investInput) return; // Protección si no existe

    let calcMsg = document.getElementById('invest-calculation');
    if (!calcMsg) {
        calcMsg = document.createElement('p');
        calcMsg.id = 'invest-calculation';
        calcMsg.className = 'text-xs font-bold text-primary text-right mt-1';
        investInput.parentNode.parentNode.appendChild(calcMsg);
    }
    const btnContinue = document.getElementById('btn-continue-invest');

    investInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const min = parseInt(investModal?.dataset.ticket || 1000);

        if (!val || val < min) {
            calcMsg.innerText = `Mínimo $${min.toLocaleString()}`;
            calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1";
            if(btnContinue) btnContinue.disabled = true;
        } else if (val % min !== 0) {
            calcMsg.innerText = `Múltiplos de $${min.toLocaleString()}`;
            calcMsg.className = "text-xs font-bold text-orange-400 text-right mt-1";
            if(btnContinue) btnContinue.disabled = true;
        } else {
            const parts = val / min;
            calcMsg.innerText = `Adquiriendo ${parts} Cupo${parts > 1 ? 's' : ''}`;
            calcMsg.className = "text-xs font-bold text-emerald-500 text-right mt-1";
            if(btnContinue) btnContinue.disabled = false;
        }
    });
}

// --- CARGA DE PORTAFOLIOS (DASHBOARD) ---
async function loadPortfolios() {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;

    try {
        const res = await fetch('/api/portfolios?t=' + Date.now());
        if(!res.ok) throw new Error("Error API");
        const data = await res.json();
        
        grid.innerHTML = '';

        // SOLO LOS PRIMEROS 3
        data.slice(0, 3).forEach(p => {
            const total = p.totalTickets || 1000;
            const sold = p.soldTickets || 0;
            const remaining = (p.remainingTickets !== undefined) ? p.remainingTickets : 1000;
            const progress = Math.min(100, (sold / total) * 100);
            
            const numFormat = new Intl.NumberFormat('es-MX');
            const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

            let badgeColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
            let dotColor = "bg-emerald-500";
            let statusText = `${numFormat.format(remaining)} cupos disp.`;
            let disabled = "";
            let btnText = "Unirme al Grupo";

            if (remaining === 0) {
                badgeColor = "bg-slate-200 text-slate-500"; dotColor = "hidden"; statusText = "AGOTADO"; disabled = "disabled"; btnText = "Cerrado";
            } else if (progress >= 90) { 
                badgeColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"; dotColor = "bg-red-500"; statusText = `¡Últimos ${remaining} cupos!`;
            }

            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(p.id - 1) % icons.length] || '📈';
            const riskColor = p.risk === 'Alto' ? 'text-red-600 bg-red-50' : (p.risk === 'Bajo' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50');

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300">
                <div class="flex justify-between mb-3 items-start">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">${icon}</div>
                    <div class="flex flex-col items-end">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${riskColor} border border-slate-100 dark:border-slate-700 leading-none">Riesgo ${p.risk}</span>
                        <span class="text-[10px] text-slate-400 mt-1">Lock: ${p.lockUpPeriod}</span>
                    </div>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1 leading-tight">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2 h-8">${p.description}</p>
                
                <div class="flex items-center gap-2 mb-4">
                    <span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${badgeColor}">
                        <span class="flex h-2 w-2 rounded-full ${dotColor} animate-pulse"></span>
                        ${statusText}
                    </span>
                </div>

                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Recaudado</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full transition-all duration-1000" style="width: ${progress}%"></div></div>
                    
                    <div class="flex justify-between items-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                         <div class="flex flex-col">
                            <span class="text-xs text-slate-400">Ticket</span>
                            <span class="text-sm font-bold text-slate-900 dark:text-white">${moneyFmt.format(p.minInvestment)}</span>
                         </div>
                         <button onclick="setupInvest(${p.id}, '${p.name}', ${p.minInvestment})" 
                            class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50" 
                            ${disabled}>
                            ${btnText}
                         </button>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { 
        console.error(e); 
        grid.innerHTML = '<p class="col-span-full text-center text-red-500 text-sm">Error de conexión</p>';
    }
}

// --- GRÁFICA PERSONAL ---
function fetchPersonalChart(token, type) {
    const ctx = document.getElementById('marketChart');
    if(!ctx) return;

    fetch('/api/chart-data', { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(d => {
        chartDataCache = d;
        renderChart(d, type);
    }).catch(e => console.error("Error gráfica:", e));
}

window.switchChart = function(type) {
    if (!chartDataCache) return;
    const btnNet = document.getElementById('btn-networth');
    const btnProf = document.getElementById('btn-profit');
    const title = document.getElementById('chart-title');

    if (type === 'netWorth') {
        btnNet.className = "px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-primary transition-all";
        btnProf.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-all";
        if(title) title.innerText = "Mi Patrimonio";
    } else {
        btnNet.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-all";
        btnProf.className = "px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-emerald-500 transition-all";
        if(title) title.innerText = "Mi Rendimiento";
    }
    renderChart(chartDataCache, type);
}

function renderChart(data, type) {
    const ctx = document.getElementById('marketChart');
    if(!ctx) return;
    
    // Destruir anterior si existe
    if (window.myChart instanceof Chart) window.myChart.destroy();

    const dataset = type === 'netWorth' ? data.netWorth : data.profit;
    const color = type === 'netWorth' ? '#307de8' : '#10b981';
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const textColor = isDark ? '#ccc' : '#666';

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates.map(ts => new Date(ts*1000).toLocaleDateString('es-MX', {day:'numeric', month:'short'})),
            datasets: [{
                data: dataset,
                borderColor: color,
                backgroundColor: (c) => {
                    const g = c.chart.ctx.createLinearGradient(0,0,0,300);
                    g.addColorStop(0, color === '#307de8' ? 'rgba(48,125,232,0.2)' : 'rgba(16,185,129,0.2)');
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    return g;
                },
                borderWidth: 2,
                pointRadius: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false }, tooltip: { enabled: true, callbacks: { label: (c) => '$' + new Intl.NumberFormat('es-MX').format(c.parsed.y) } } },
            scales: {
                x: { display: true, grid: {display:false}, ticks: {color:textColor, maxTicksLimit:6} },
                y: { display: true, grid: {color:gridColor}, ticks: {color:textColor, callback:v=>'$'+v} }
            }
        }
    });
}

// --- HELPERS DATOS ---
async function updateUserData(token) { 
    try { 
        const r = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }); 
        if(r.ok) updateBalanceUI(await r.json()); 
    } catch(e){} 
}

function updateBalanceUI(d) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const setText = (id, v) => { const el = document.getElementById(id); if(el) el.innerHTML = v; };
    
    setText('display-net-worth', `${fmt.format(d.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    setText('display-available', fmt.format(d.availableBalance));
    setText('display-invested', fmt.format(d.investedAmount));
    setText('modal-balance-display', fmt.format(d.availableBalance));
    setText('withdraw-max-balance', fmt.format(d.availableBalance));
    
    const p = document.getElementById('display-profit');
    if(p) { 
        p.innerText = (d.profit >= 0 ? '+' : '') + fmt.format(d.profit); 
        p.className = d.profit >= 0 ? "text-emerald-500 font-bold text-lg" : "text-red-500 font-bold text-lg"; 
    }
}

// --- FORMULARIOS ---
function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if(!amount || amount < min || amount % min !== 0) return;
        
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
        document.getElementById('confirm-amount-display').innerText = fmt.format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        
        step1Div.classList.add('hidden'); 
        step2Div.classList.remove('hidden');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        const pid = investModalIdInput.value;
        const amount = document.getElementById('invest-amount').value;
        try {
            const res = await fetch('/api/invest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ portfolioId: pid, amount, token })
            });
            if(res.ok) { 
                closeModal(); updateUserData(token); loadPortfolios(); showSuccess(); fetchPersonalChart(token, 'netWorth');
            } else { 
                const d = await res.json(); alert(d.message); backToStep1(); 
            }
        } catch(e) { alert("Error de red"); backToStep1(); }
        btnFinalConfirm.innerText = "Confirmar";
    });
}

function setupExtraInputs() {
    // Inputs tarjeta
    const cIn = document.getElementById('card-number'); if(cIn) cIn.addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g,'').substring(0,16).match(/.{1,4}/g)?.join(' ')||e.target.value);
    const eIn = document.getElementById('card-expiry'); if(eIn) eIn.addEventListener('input', e => { let v=e.target.value.replace(/\D/g,''); if(v.length>2) v=v.substring(0,2)+'/'+v.substring(2,4); e.target.value=v; });

    // Deposito Simple (Sin stripe, para que funcione en móvil rápido)
    const dep = document.getElementById('deposit-form'); 
    if(dep) dep.addEventListener('submit', async(e)=>{ 
        e.preventDefault(); 
        const a=document.getElementById('deposit-amount').value; 
        const b=document.getElementById('btn-confirm-deposit');
        b.disabled=true; b.innerText="Procesando...";
        try{ 
            const r=await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); 
            if(r.ok){
                closeDepositModal();updateUserData(localStorage.getItem('token'));document.getElementById('deposit-amount').value='';alert("Depósito OK");fetchPersonalChart(localStorage.getItem('token'), 'netWorth');
            } 
        }catch(e){} finally{b.disabled=false;b.innerText="Pagar Ahora";} 
    });

    const wit = document.getElementById('withdraw-form'); if(wit) wit.addEventListener('submit', async(e)=>{ e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{ await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); closeWithdrawModal(); updateUserData(localStorage.getItem('token')); document.getElementById('withdraw-amount').value=''; alert("Retiro OK"); fetchPersonalChart(localStorage.getItem('token'), 'netWorth'); }catch(e){} });
}

// GLOBALES
window.setupInvest = function(id, name, ticket) {
    if(!investModal) return;
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.dataset.ticket = ticket;
    backToStep1();
    investModal.classList.remove('hidden'); setTimeout(() => { investModal.classList.remove('opacity-0'); investModal.querySelector('div').classList.add('scale-100'); }, 10);
    const inp = document.getElementById('invest-amount'); if(inp) { inp.value = ''; inp.placeholder = `Ej. ${ticket}`; inp.step = ticket; inp.min = ticket; }
    const msg = document.getElementById('invest-calculation'); if(msg) { msg.innerText = `Mínimo $${ticket.toLocaleString('es-MX')}`; msg.className = "text-xs font-bold text-primary text-right mt-1"; }
}
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.showSuccess = function() { if(successModal) { successModal.classList.remove('hidden'); setTimeout(() => { successModal.classList.remove('opacity-0'); successModal.querySelector('div').classList.add('scale-100'); }, 10); } }
window.closeSuccessModal = function() { if(successModal) { successModal.classList.add('opacity-0'); setTimeout(() => successModal.classList.add('hidden'), 300); } }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { const b = document.getElementById('modal-balance-display')?.innerText || "0"; document.getElementById('withdraw-max-balance').innerText = b; withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};