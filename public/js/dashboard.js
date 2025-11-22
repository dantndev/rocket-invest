// public/js/dashboard.js (COMPLETO)
const stripe = Stripe("pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp");
let elements;
let investModal, depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;
let myChart, chartDataCache;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }
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

window.initStripePayment = async function() {
    const amount = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    if(!amount || amount <= 0) { alert("Monto inválido"); return; }
    btn.disabled = true; btn.innerText = "Conectando...";
    try {
        const res = await fetch('/api/create-payment-intent', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`}, body: JSON.stringify({amount, token:localStorage.getItem('token')}) });
        const d = await res.json();
        if(d.error) throw new Error(d.error);

        // UPDATE SUMMARY
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
        document.getElementById('stripe-summary-amount').innerText = fmt.format(amount);

        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('stripe-container').classList.remove('hidden');
        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: d.clientSecret, appearance });
        const pe = elements.create('payment'); pe.mount('#payment-element');
        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault(); e.target.disabled = true; e.target.innerText = "Procesando...";
            const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
            if (error) { alert(error.message); e.target.disabled = false; e.target.innerText = "Pagar Ahora"; } 
            else {
                await fetch('/api/deposit', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`}, body:JSON.stringify({amount, token:localStorage.getItem('token')}) });
                closeDepositModal(); updateUserData(localStorage.getItem('token')); showSuccess();
                document.getElementById('deposit-amount').value = ''; document.getElementById('deposit-step-1').classList.remove('hidden'); document.getElementById('stripe-container').classList.add('hidden'); btn.disabled=false; btn.innerText="Iniciar Pago";
                fetchPersonalChart(localStorage.getItem('token'), 'netWorth');
            }
        };
    } catch(e) { console.error(e); alert("Error Stripe"); btn.disabled=false; btn.innerText="Iniciar"; }
}

async function loadPortfolios() {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;
    const res = await fetch('/api/portfolios?t='+Date.now());
    const data = await res.json();
    grid.innerHTML = '';
    data.slice(0,3).forEach(p => {
        const total=p.totalTickets||1000; const sold=p.soldTickets||0; const rem=p.remainingTickets!==undefined?p.remainingTickets:1000; const prog=Math.min(100,(sold/total)*100); const mf=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); const nf=new Intl.NumberFormat('es-MX');
        let bc="bg-emerald-100 text-emerald-700", dc="bg-emerald-500", st=`${nf.format(rem)} cupos`, dis="", bt="Unirme";
        if(rem===0){bc="bg-slate-200 text-slate-500";dc="hidden";st="AGOTADO";dis="disabled";bt="Cerrado";} else if(prog>=90){bc="bg-red-100 text-red-700";dc="bg-red-500";st=`¡Últimos ${rem}!`;}
        const icons=['🚀','💻','🌍','🌱','💎','🏗️','🇺🇸','🎮','🏆']; const icon=icons[(p.id-1)%icons.length]; let rc=p.risk==='Alto'?'text-red-600 bg-red-50':'text-green-600 bg-green-50';
        grid.innerHTML += `<div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full"><div class="flex justify-between mb-3"><div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">${icon}</div><div class="flex flex-col items-end"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rc}">Riesgo ${p.risk}</span><span class="text-[10px] text-slate-400 mt-1">Lock: ${p.lockUpPeriod}</span></div></div><h3 class="font-bold text-lg dark:text-white mb-1">${p.name}</h3><p class="text-xs text-slate-500 mb-4 h-8 overflow-hidden">${p.description}</p><div class="flex items-center gap-2 mb-4"><span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${bc}"><span class="flex h-2 w-2 rounded-full ${dc} animate-pulse"></span>${st}</span></div><div class="mt-auto"><div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Recaudado</span><span class="text-primary">${prog.toFixed(0)}%</span></div><div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width:${prog}%"></div></div><div class="flex justify-between mt-4 pt-2 border-t border-slate-100 dark:border-slate-700"><div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold dark:text-white">${mf.format(p.minInvestment)}</span></div><button onclick="setupInvest(${p.id},'${p.name}',${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90" ${dis}>${bt}</button></div></div></div>`;
    });
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
        else { msg.innerText=`${v/min} Cupos`; msg.className="text-xs font-bold text-emerald-500 text-right mt-1"; if(btn) btn.disabled=false; }
    });
}

function fetchPersonalChart(token, type) {
    const ctx = document.getElementById('marketChart'); if(!ctx) return;
    fetch('/api/chart-data', { headers: { 'Authorization': `Bearer ${token}` } }).then(r=>r.json()).then(d=>{
        chartDataCache = d;
        renderChart(d, type);
    });
}
window.switchChart = function(type) {
    if (!chartDataCache) return;
    document.getElementById('btn-networth').className = type==='netWorth'?"px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-primary":"px-3 py-1 text-xs font-bold rounded-md text-slate-500";
    document.getElementById('btn-profit').className = type!=='netWorth'?"px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-emerald-500":"px-3 py-1 text-xs font-bold rounded-md text-slate-500";
    renderChart(chartDataCache, type);
}
function renderChart(d, t) {
    const ctx = document.getElementById('marketChart');
    if (window.myChart) window.myChart.destroy();
    const ds = t === 'netWorth' ? d.netWorth : d.profit;
    const cl = t === 'netWorth' ? '#307de8' : '#10b981';
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: d.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX',{day:'numeric',month:'short'})), datasets:[{data:ds, borderColor:cl, borderWidth:2, pointRadius:3, fill:true, backgroundColor:(c)=>{const g=c.chart.ctx.createLinearGradient(0,0,0,250); g.addColorStop(0,cl+'33'); g.addColorStop(1,cl+'00'); return g;}}] },
        options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{display:false},tooltip:{enabled:true}}, scales:{x:{display:true,grid:{display:false}},y:{display:true,grid:{color:'rgba(150,150,150,0.1)'}}} }
    });
}

function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => { e.preventDefault(); const am = parseInt(document.getElementById('invest-amount').value); const min = parseInt(investModal.dataset.ticket || 1000); if(!am || am<min || am%min!==0) return; document.getElementById('confirm-amount-display').innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(am); document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText; step1Div.classList.add('hidden'); step2Div.classList.remove('hidden'); });
    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        try {
            const res = await fetch('/api/invest', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ portfolioId: investModalIdInput.value, amount: document.getElementById('invest-amount').value, token }) });
            if(res.ok) { closeModal(); updateUserData(token); loadPortfolios(); showSuccess(); fetchPersonalChart(token,'netWorth'); } 
            else { const d = await res.json(); alert(d.message); window.backToStep1(); }
        } catch(e) { alert("Error"); window.backToStep1(); }
        btnFinalConfirm.innerText = "Confirmar";
    });
}
function setupExtraInputs() {
    const c = document.getElementById('card-number'); if(c) c.addEventListener('input', e=>e.target.value=e.target.value.replace(/\D/g,'').substring(0,16).match(/.{1,4}/g)?.join(' ')||e.target.value);
    const ex = document.getElementById('card-expiry'); if(ex) ex.addEventListener('input', e=>{let v=e.target.value.replace(/\D/g,''); if(v.length>2) v=v.substring(0,2)+'/'+v.substring(2,4); e.target.value=v;});
    const wit = document.getElementById('withdraw-form'); if(wit) wit.addEventListener('submit', async(e)=>{ e.preventDefault(); try{ await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:document.getElementById('withdraw-amount').value,token:localStorage.getItem('token')})}); window.closeWithdrawModal(); updateUserData(localStorage.getItem('token')); fetchPersonalChart(localStorage.getItem('token'),'netWorth'); alert("Retiro OK"); }catch{} });
}
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) { const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); document.getElementById('display-net-worth').innerHTML=`${f.format(d.netWorth)} <span class="text-2xl font-normal">MXN</span>`; document.getElementById('display-available').innerText=f.format(d.availableBalance); document.getElementById('display-invested').innerText=f.format(d.investedAmount); document.getElementById('modal-balance-display').innerText=f.format(d.availableBalance); document.getElementById('withdraw-max-balance').innerText=f.format(d.availableBalance); }

window.setupInvest = function(id,n,t) { if(!investModal) return; investModalTitle.innerText=n; investModalIdInput.value=id; investModal.dataset.ticket=t; window.backToStep1(); investModal.classList.remove('hidden'); setTimeout(()=>investModal.classList.remove('opacity-0'),10); const i=document.getElementById('invest-amount'); if(i){i.value='';i.placeholder=`Ej. ${t}`;i.step=t;i.min=t;} const m=document.getElementById('invest-calculation'); if(m) m.innerText=`Mín $${t}`; }
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(()=>investModal.classList.add('hidden'),300); }
window.showSuccess = function() { successModal.classList.remove('hidden'); setTimeout(()=>successModal.classList.remove('opacity-0'),10); }
window.closeSuccessModal = function() { successModal.classList.add('opacity-0'); setTimeout(()=>successModal.classList.add('hidden'),300); }
window.openDepositModal = function() { depositModal.classList.remove('hidden'); setTimeout(()=>depositModal.classList.remove('opacity-0'),10); }
window.closeDepositModal = function() { depositModal.classList.add('opacity-0'); setTimeout(()=>depositModal.classList.add('hidden'),300); }
window.openWithdrawModal = function() { withdrawModal.classList.remove('hidden'); setTimeout(()=>withdrawModal.classList.remove('opacity-0'),10); }
window.closeWithdrawModal = function() { withdrawModal.classList.add('opacity-0'); setTimeout(()=>withdrawModal.classList.add('hidden'),300); }