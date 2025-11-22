// public/js/dashboard.js

// STRIPE KEY
const stripe = Stripe("pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp");
let elements, myChart, chartDataCache;

// Variables UI Globales
let investModal, investModalTitle, investModalIdInput;
let depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm;
let confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // 1. CAPTURAR REFERENCIAS DOM
    investModal = document.getElementById('invest-modal');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');
    successModal = document.getElementById('success-modal');
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    btnFinalConfirm = document.getElementById('btn-final-confirm');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');

    // 2. CALCULADORA INVERSIÓN
    initCalculator();

    // 3. CARGA DE DATOS
    await updateUserData(token);
    await loadPortfolios();
    fetchPersonalChart(token, 'netWorth');

    // 4. LISTENERS
    document.getElementById('btn-ver-todos')?.addEventListener('click', () => window.location.href = 'portfolios.html');
    setupFormListeners(token);
    setupExtraInputs();
});

// --- FUNCIONES EXPORTADAS A WINDOW (PARA QUE EL HTML LAS VEA) ---

window.setupInvest = function(id, name, ticket) {
    if(!investModal) return;
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.dataset.ticket = ticket;

    // Resetear estado
    window.backToStep1();
    investModal.classList.remove('hidden'); 
    setTimeout(() => { 
        investModal.classList.remove('opacity-0'); 
        investModal.querySelector('div').classList.add('scale-100'); 
    }, 10);

    // Limpiar input
    const inp = document.getElementById('invest-amount'); 
    if(inp) { 
        inp.value = ''; 
        inp.placeholder = `Ej. ${ticket}`; 
        inp.step = ticket; 
        inp.min = ticket; 
    }
    const msg = document.getElementById('invest-calculation'); 
    if(msg) { 
        msg.innerText = `Mínimo $${ticket.toLocaleString('es-MX')}`; 
        msg.className = "text-xs font-bold text-primary text-right mt-1"; 
    }
}

window.initStripePayment = async function() {
    const amount = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    
    if(!amount || amount <= 0) { alert("Monto inválido"); return; }
    
    btn.disabled = true; 
    btn.innerText = "Conectando...";

    try {
        const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
            body: JSON.stringify({amount, token:localStorage.getItem('token')})
        });
        const d = await res.json();
        if(d.error) throw new Error(d.error);

        // Mostrar resumen
        document.getElementById('stripe-summary-amount').innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(amount);
        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('stripe-container').classList.remove('hidden');

        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: d.clientSecret, appearance });
        const pe = elements.create('payment');
        pe.mount('#payment-element');

        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault(); 
            e.target.disabled = true; 
            e.target.innerText = "Procesando...";
            
            const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });

            if (error) { 
                alert(error.message); 
                e.target.disabled = false; 
                e.target.innerText = "Pagar Ahora"; 
            } else {
                await fetch('/api/deposit', {
                    method:'POST', 
                    headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
                    body:JSON.stringify({amount, token:localStorage.getItem('token')})
                });
                window.closeDepositModal();
                updateUserData(localStorage.getItem('token'));
                window.showSuccess();
                // Reset
                document.getElementById('deposit-amount').value = '';
                document.getElementById('deposit-step-1').classList.remove('hidden');
                document.getElementById('stripe-container').classList.add('hidden');
                btn.disabled = false; btn.innerText = "Iniciar Pago";
                fetchPersonalChart(localStorage.getItem('token'), 'netWorth');
            }
        };

    } catch(e) { 
        console.error(e); 
        alert("Error de conexión con pasarela"); 
        btn.disabled = false; 
        btn.innerText = "Iniciar Pago Seguro"; 
    }
}

// --- FUNCIONES INTERNAS ---

async function loadPortfolios() {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;

    try {
        const res = await fetch('/api/portfolios?t=' + Date.now());
        const data = await res.json();
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
            let disabled = ""; 
            let btnText = "Unirme al Grupo";

            if (remaining === 0) {
                badgeColor = "bg-slate-200 text-slate-500"; dotColor = "hidden"; statusText = "AGOTADO"; disabled = "disabled"; btnText = "Cerrado";
            } else if (progress >= 90) {
                badgeColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"; dotColor = "bg-red-500"; statusText = `¡Últimos ${remaining}!`;
            }

            const icons = ['🚀','💻','🌍','🌱','💎','🏗️','🇺🇸','🎮','🏆'];
            const icon = icons[(p.id - 1) % icons.length] || '📈';
            let riskColor = p.risk === 'Alto' ? 'text-red-600 bg-red-50' : (p.risk === 'Bajo' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50');

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300">
                <div class="flex justify-between mb-3 items-start">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">${icon}</div>
                    <div class="flex flex-col items-end">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${riskColor} border border-slate-100 dark:border-slate-700 leading-none">Riesgo ${p.risk}</span>
                        <span class="text-[10px] text-slate-400 mt-1">Lock: ${p.lockUpPeriod}</span>
                    </div>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2 h-8">${p.description}</p>
                <div class="flex items-center gap-2 mb-4">
                    <span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${badgeColor}">
                        <span class="flex h-2 w-2 rounded-full ${dotColor} animate-pulse"></span>
                        ${statusText}
                    </span>
                </div>
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Recaudado</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width:${progress}%"></div></div>
                    <div class="flex justify-between items-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                         <div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold text-slate-900 dark:text-white">${moneyFmt.format(p.minInvestment)}</span></div>
                         <button onclick="setupInvest(${p.id}, '${p.name}', ${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50" ${disabled}>${btnText}</button>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

function initCalculator() {
    const inp = document.getElementById('invest-amount');
    if(!inp) return;
    let msg = document.getElementById('invest-calculation');
    if(!msg) { msg=document.createElement('p'); msg.id='invest-calculation'; msg.className='text-xs font-bold text-primary text-right mt-1'; inp.parentNode.appendChild(msg); }
    const btn = document.getElementById('btn-continue-invest');

    inp.addEventListener('input', (e)=>{
        const v = parseInt(e.target.value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if(!v || v<min) { msg.innerText=`Mínimo $${min}`; msg.className="text-xs font-bold text-red-400 text-right mt-1"; if(btn) btn.disabled=true; }
        else if(v%min!==0) { msg.innerText=`Múltiplos de $${min}`; msg.className="text-xs font-bold text-orange-400 text-right mt-1"; if(btn) btn.disabled=true; }
        else { msg.innerText=`Adquiriendo ${v/min} Ticket${(v/min)>1?'s':''}`; msg.className="text-xs font-bold text-emerald-500 text-right mt-1"; if(btn) btn.disabled=false; }
    });
}

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
                window.closeModal(); 
                updateUserData(token); 
                loadPortfolios(); 
                window.showSuccess(); 
                fetchPersonalChart(token,'netWorth');
            } else { 
                const d = await res.json(); alert(d.message); window.backToStep1(); 
            }
        } catch(e) { alert("Error de red"); window.backToStep1(); }
        btnFinalConfirm.innerText = "Confirmar";
    });
}

function renderMarketChart() { /* (Mismo código que antes) */ const ctx=document.getElementById('marketChart'); if(!ctx)return; try{ const isDark=document.documentElement.classList.contains('dark'); const textColor=isDark?'#94a3b8':'#64748b'; const gridColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'; fetch('/api/market').then(r=>r.json()).then(d=>{ new Chart(ctx,{type:'line',data:{labels:d.dates.map(t=>new Date(t*1000).toLocaleDateString('es-MX')),datasets:[{data:d.prices,borderColor:'#307de8',borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{grid:{color:gridColor},ticks:{color:textColor}},x:{display:false}}}}); }); }catch(e){} }
function fetchPersonalChart(token, type) { const ctx=document.getElementById('marketChart'); if(!ctx)return; fetch('/api/chart-data',{headers:{'Authorization':`Bearer ${token}`}}).then(r=>r.json()).then(d=>{ chartDataCache=d; renderChart(d,type); }).catch(e=>{}); }
function renderChart(d, t) { const ctx=document.getElementById('marketChart'); if(window.myChart) window.myChart.destroy(); const ds = t === 'netWorth' ? d.netWorth : d.profit; const cl = t === 'netWorth' ? '#307de8' : '#10b981'; window.myChart = new Chart(ctx, { type: 'line', data: { labels: d.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX')), datasets:[{data:ds, borderColor:cl, borderWidth:2, pointRadius:0, fill:true, backgroundColor:cl+'22'}] }, options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{display:false},y:{display:true}} } }); }
window.switchChart = function(t) { if(!chartDataCache) return; renderChart(chartDataCache, t); }

// HELPERS
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) { const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); const s=(i,v)=>{const e=document.getElementById(i);if(e)e.innerHTML=v;}; s('display-net-worth',`${f.format(d.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`); s('display-available',f.format(d.availableBalance)); s('display-invested',f.format(d.investedAmount)); s('modal-balance-display',f.format(d.availableBalance)); s('withdraw-max-balance',f.format(d.availableBalance)); const n=d.first_name?d.first_name.split(' ')[0]:'Inversor'; const g=document.getElementById('user-greeting'); if(g) g.innerText=`Hola, ${n}`; }
function setupExtraInputs() { const w=document.getElementById('withdraw-form'); if(w) w.addEventListener('submit', async(e)=>{ e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{ await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); window.closeWithdrawModal(); updateUserData(localStorage.getItem('token')); alert("Retiro OK"); }catch{} }); }

// MODALES
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.showSuccess = function() { if(successModal) { successModal.classList.remove('hidden'); setTimeout(() => successModal.classList.remove('opacity-0'), 10); } }
window.closeSuccessModal = function() { if(successModal) { successModal.classList.add('opacity-0'); setTimeout(() => successModal.classList.add('hidden'), 300); } }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};