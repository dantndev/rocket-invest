// public/js/dashboard.js

// 1. DEFINIR TODO GLOBALMENTE PRIMERO (A PRUEBA DE FALLOS)
const stripe = Stripe("pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp");
let elements, myChart, chartDataCache;

// Variables UI
let investModal, depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

// --- FUNCIONES GLOBALES DE VENTANAS (TIENEN QUE ESTAR DISPONIBLES SIEMPRE) ---
window.setupInvest = function(id, name, ticket) {
    if(!investModal) investModal = document.getElementById('invest-modal');
    if(!investModal) return console.error("No modal found");
    
    // Refs internas dinámicas
    document.getElementById('modal-portfolio-name').innerText = name;
    document.getElementById('modal-portfolio-id').value = id;
    investModal.dataset.ticket = ticket;
    
    window.backToStep1();
    investModal.classList.remove('hidden');
    setTimeout(() => {
        investModal.classList.remove('opacity-0');
        investModal.querySelector('div').classList.add('scale-100');
    }, 10);

    const inp = document.getElementById('invest-amount');
    const msg = document.getElementById('invest-calculation');
    if(inp) { inp.value = ''; inp.placeholder = `Ej. ${ticket}`; inp.min = ticket; inp.step = ticket; }
    if(msg) { msg.innerText = `Mínimo $${ticket.toLocaleString('es-MX')}`; msg.className = "text-xs font-bold text-primary text-right mt-1"; }
};

window.initStripePayment = async function() {
    const amountVal = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    
    if(!amountVal || amountVal <= 0) { alert("Monto inválido"); return; }
    
    btn.disabled = true; btn.innerText = "Conectando...";

    try {
        const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
            body: JSON.stringify({amount: amountVal, token: localStorage.getItem('token')})
        });
        
        const d = await res.json();
        if(d.error) throw new Error(d.error);

        // AQUÍ FALLABA ANTES: Ahora el elemento SÍ existe en el HTML
        const summaryEl = document.getElementById('stripe-summary-amount');
        if(summaryEl) summaryEl.innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(amountVal);

        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('stripe-container').classList.remove('hidden');

        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: d.clientSecret, appearance });
        const pe = elements.create('payment');
        pe.mount('#payment-element');

        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault(); e.target.disabled = true; e.target.innerText = "Procesando...";
            const {error} = await stripe.confirmPayment({elements, redirect:'if_required'});
            
            if(error) { 
                alert(error.message); e.target.disabled=false; e.target.innerText="Pagar"; 
            } else {
                await fetch('/api/deposit', {
                    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
                    body:JSON.stringify({amount: amountVal, token:localStorage.getItem('token')})
                });
                window.closeDepositModal();
                updateUserData(localStorage.getItem('token'));
                window.showSuccess();
                document.getElementById('deposit-amount').value='';
                document.getElementById('deposit-step-1').classList.remove('hidden');
                document.getElementById('stripe-container').classList.add('hidden');
                btn.disabled=false; btn.innerText="Iniciar Pago";
                fetchPersonalChart(localStorage.getItem('token'),'netWorth');
            }
        };

    } catch(e) { console.error(e); alert("Error Stripe: " + e.message); btn.disabled=false; btn.innerText="Iniciar"; }
};

// --- INICIO DE LA APP ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Inicializar Refs
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

    initCalculator();
    await updateUserData(token);
    await loadPortfolios();
    fetchPersonalChart(token, 'netWorth');

    document.getElementById('btn-ver-todos')?.addEventListener('click', () => window.location.href = 'portfolios.html');
    setupFormListeners(token);
    setupExtraInputs();
});

// --- LÓGICA DE NEGOCIO ---

async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios?t=' + Date.now());
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        data.slice(0, 3).forEach(p => {
            const total = p.totalTickets || 1000;
            const sold = p.soldTickets || 0;
            const remaining = (p.remainingTickets !== undefined) ? p.remainingTickets : 1000;
            const progress = Math.min(100, (sold / total) * 100);
            const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            const numFmt = new Intl.NumberFormat('es-MX');

            let badgeColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
            let dotColor = "bg-emerald-500";
            let statusText = `${numFmt.format(remaining)} cupos disp.`;
            let disabled = ""; let btnText = "Unirme al Grupo";

            if (remaining === 0) { badgeColor="bg-slate-200 text-slate-500"; dotColor="hidden"; statusText="AGOTADO"; disabled="disabled"; btnText="Cerrado"; }
            else if (progress >= 90) { badgeColor="bg-red-100 text-red-700"; dotColor="bg-red-500"; statusText=`¡Últimos ${remaining}!`; }

            const icons = ['🚀','💻','🌍','🌱','💎','🏗️','🇺🇸','🎮','🏆'];
            const icon = icons[(p.id-1)%icons.length] || '📈';
            let riskColor = p.risk === 'Alto' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50';

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300">
                <div class="flex justify-between mb-3 items-start">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">${icon}</div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${riskColor}">${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">${p.name}</h3>
                <div class="flex items-center gap-2 mb-4"><span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${badgeColor}"><span class="flex h-2 w-2 rounded-full ${dotColor} animate-pulse"></span>${statusText}</span></div>
                <div class="mt-auto"><div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2"><div class="bg-primary h-2 rounded-full" style="width:${progress}%"></div></div><div class="flex justify-between items-end mt-4 pt-2 border-t border-slate-100 dark:border-slate-700"><div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold text-slate-900 dark:text-white">${moneyFmt.format(p.minInvestment)}</span></div><button onclick="setupInvest(${p.id}, '${p.name}', ${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity" ${disabled}>${btnText}</button></div></div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

// --- GRÁFICA ---
function fetchPersonalChart(token, type) {
    const ctx = document.getElementById('marketChart'); if(!ctx) return;
    fetch('/api/chart-data', { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r=>r.json()).then(d=>{ chartDataCache=d; renderChart(d,type); }).catch(e=>{});
}
window.switchChart = function(type) {
    if(!chartDataCache) return;
    const t = document.getElementById('chart-title');
    if(t) t.innerText = type==='netWorth' ? "Mi Patrimonio" : "Mi Rendimiento";
    renderChart(chartDataCache, type);
}
function renderChart(data, type) {
    const ctx = document.getElementById('marketChart');
    if(window.myChart instanceof Chart) window.myChart.destroy();
    const ds = type === 'netWorth' ? data.netWorth : data.profit;
    const cl = type === 'netWorth' ? '#307de8' : '#10b981';
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: data.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX',{day:'numeric',month:'short'})), datasets:[{data:ds, borderColor:cl, borderWidth:2, pointRadius:3, pointHitRadius:20, backgroundColor:cl+'33', fill:true}] },
        options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{display:false},tooltip:{enabled:true}}, scales:{x:{display:true, grid:{display:false}, ticks:{color:textColor}}, y:{display:true, grid:{color:gridColor}, ticks:{color:textColor, callback:v=>'$'+v}}} }
    });
}

// --- HELPERS ---
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) { const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); document.getElementById('display-net-worth').innerHTML=`${f.format(d.netWorth)} <span class="text-2xl font-normal">MXN</span>`; document.getElementById('display-available').innerText=f.format(d.availableBalance); document.getElementById('display-invested').innerText=f.format(d.investedAmount); document.getElementById('modal-balance-display').innerText=f.format(d.availableBalance); document.getElementById('withdraw-max-balance').innerText=f.format(d.availableBalance); const g=document.getElementById('user-greeting'); if(g) g.innerText=`Hola, ${d.first_name?d.first_name.split(' ')[0]:'Inversor'}`; }

function initCalculator() {
    const inp = document.getElementById('invest-amount'); if(!inp) return;
    const msg = document.getElementById('invest-calculation');
    const btn = document.getElementById('btn-continue-invest');
    inp.addEventListener('input', (e)=>{
        const v = parseInt(e.target.value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if(!v||v<min) { msg.innerText=`Mín $${min}`; msg.style.color='red'; if(btn) btn.disabled=true; }
        else if(v%min!==0) { msg.innerText=`Múltiplos de $${min}`; msg.style.color='orange'; if(btn) btn.disabled=true; }
        else { msg.innerText=`${v/min} Tickets`; msg.style.color='#10b981'; if(btn) btn.disabled=false; }
    });
}

function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', e=>{ e.preventDefault(); const am=parseInt(document.getElementById('invest-amount').value); document.getElementById('confirm-amount-display').innerText=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(am); document.getElementById('confirm-portfolio-name').innerText=investModalTitle.innerText; window.backToStep1(); document.getElementById('invest-step-1').classList.add('hidden'); document.getElementById('invest-step-2').classList.remove('hidden'); });
    
    const btn = document.getElementById('btn-final-confirm');
    if(btn) btn.addEventListener('click', async()=>{
        btn.innerText="Procesando...";
        try{ const r=await fetch('/api/invest',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({portfolioId:investModalIdInput.value, amount:document.getElementById('invest-amount').value, token})}); if(r.ok){ window.closeModal(); updateUserData(token); loadPortfolios(); window.showSuccess(); fetchPersonalChart(token,'netWorth'); } else { alert((await r.json()).message); window.backToStep1(); } } catch(e){alert("Error");window.backToStep1();} btn.innerText="Confirmar";
    });
}

function setupExtraInputs() {
    const w = document.getElementById('withdraw-form'); if(w) w.addEventListener('submit', async(e)=>{e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); window.closeWithdrawModal(); updateUserData(localStorage.getItem('token')); alert("Retiro OK"); fetchPersonalChart(localStorage.getItem('token'),'netWorth');}catch{}});
}

// Modales
window.backToStep1 = function() { document.getElementById('invest-step-1').classList.remove('hidden'); document.getElementById('invest-step-2').classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.showSuccess = function() { if(successModal) { successModal.classList.remove('hidden'); setTimeout(() => successModal.classList.remove('opacity-0'), 10); } }
window.closeSuccessModal = function() { if(successModal) { successModal.classList.add('opacity-0'); setTimeout(() => successModal.classList.add('hidden'), 300); } }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { const b = document.getElementById('modal-balance-display')?.innerText || "0"; document.getElementById('withdraw-max-balance').innerText = b; withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};