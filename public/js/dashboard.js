// public/js/dashboard.js
const stripe = Stripe("pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp");
let elements, investModal, depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm, investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;
let myChart, chartDataCache;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Referencias
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

    // Calculadora
    initCalculator();

    // Carga
    await updateUserData(token);
    await loadPortfolios();
    fetchPersonalChart(token, 'netWorth');

    document.getElementById('btn-ver-todos')?.addEventListener('click', () => window.location.href = 'portfolios.html');
    setupFormListeners(token);
    setupExtraInputs();
});

// ... RESTO DEL CÓDIGO (loadPortfolios, renderChart, Stripe) ...
// COPIA LAS FUNCIONES: initStripePayment, loadPortfolios, fetchPersonalChart, switchChart, renderChart, updateUserData, updateBalanceUI, setupFormListeners, setupExtraInputs, setupInvest, backToStep1, closeModal, showSuccess, closeSuccessModal, open/close Deposit/Withdraw
// (Son las mismas de la versión anterior que funcionaba. Pégalas aquí abajo)

async function loadPortfolios() {
    const grid = document.getElementById('portfolio-grid'); if(!grid) return;
    try { const res=await fetch('/api/portfolios?t='+Date.now()); const data=await res.json(); grid.innerHTML=''; data.slice(0,3).forEach(p=>{
        const total=p.totalTickets||1000;const sold=p.soldTickets||0;const rem=p.remainingTickets!==undefined?p.remainingTickets:1000;const prog=Math.min(100,(sold/total)*100);const mf=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});const nf=new Intl.NumberFormat('es-MX');
        let bc="bg-emerald-100 text-emerald-700", dc="bg-emerald-500", st=`${nf.format(rem)} cupos`, dis="", bt="Unirme";
        if(rem===0){bc="bg-slate-200 text-slate-500";dc="hidden";st="AGOTADO";dis="disabled";bt="Cerrado";} else if(prog>=90){bc="bg-red-100 text-red-700";dc="bg-red-500";st=`¡Últimos ${rem}!`;}
        const icons=['🚀','💻','🌍','🌱','💎','🏗️','🇺🇸','🎮','🏆']; const icon=icons[(p.id-1)%icons.length] || '📈'; 
        grid.innerHTML+=`<div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full"><div class="flex justify-between mb-3"><div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">${icon}</div><span class="text-xs font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded">${p.risk}</span></div><h3 class="font-bold text-lg dark:text-white mb-1">${p.name}</h3><p class="text-xs text-slate-500 mb-4 line-clamp-2">${p.description}</p><div class="flex items-center gap-2 mb-4"><span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${bc}"><span class="flex h-2 w-2 rounded-full ${dc} animate-pulse"></span>${st}</span></div><div class="mt-auto"><div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2"><div class="bg-primary h-2 rounded-full" style="width:${prog}%"></div></div><div class="flex justify-between mt-4 pt-2 border-t border-slate-100 dark:border-slate-700"><div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold dark:text-white">${mf.format(p.minInvestment)}</span></div><button onclick="setupInvest(${p.id},'${p.name}',${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90" ${dis}>${bt}</button></div></div></div>`;
    });}catch(e){}
}

function initCalculator() { const inp=document.getElementById('invest-amount'); if(!inp)return; let msg=document.getElementById('invest-calculation'); if(!msg){msg=document.createElement('p');msg.id='invest-calculation';msg.className='text-xs font-bold text-primary text-right mt-1';inp.parentNode.appendChild(msg);} inp.addEventListener('input',e=>{const v=parseInt(e.target.value); const min=parseInt(investModal.dataset.ticket||1000); if(!v||v<min){msg.innerText=`Mín $${min}`;msg.style.color='red';}else if(v%min!==0){msg.innerText=`Múltiplos $${min}`;msg.style.color='orange';}else{msg.innerText=`${v/min} Cupos`;msg.style.color='#10b981';}}); }

async function updateUserData(t){try{const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${t}`}});if(r.ok)updateBalanceUI(await r.json());}catch{}}
function updateBalanceUI(d){const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); const s=(i,v)=>{const e=document.getElementById(i);if(e)e.innerHTML=v;}; s('display-net-worth',`${f.format(d.netWorth)} <span class="text-2xl font-normal">MXN</span>`); s('display-available',f.format(d.availableBalance)); s('display-invested',f.format(d.investedAmount)); s('modal-balance-display',f.format(d.availableBalance)); s('withdraw-max-balance',f.format(d.availableBalance)); const n=d.first_name?d.first_name.split(' ')[0]:'Inversor'; document.getElementById('user-greeting').innerText=`Hola, ${n}`; }
function fetchPersonalChart(t,tp){const c=document.getElementById('marketChart');if(!c)return;fetch('/api/chart-data',{headers:{'Authorization':`Bearer ${t}`}}).then(r=>r.json()).then(d=>{chartDataCache=d;renderChart(d,tp);});}
window.switchChart=function(t){if(!chartDataCache)return;renderChart(chartDataCache,t);}
function renderChart(d,t){const ctx=document.getElementById('marketChart');if(window.myChart)window.myChart.destroy(); window.myChart=new Chart(ctx,{type:'line',data:{labels:d.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX')),datasets:[{data:t==='netWorth'?d.netWorth:d.profit,borderColor:t==='netWorth'?'#307de8':'#10b981',borderWidth:2,pointRadius:0}]},options:{maintainAspectRatio:false,scales:{x:{display:false},y:{display:false}},plugins:{legend:{display:false}}}});}
function setupFormListeners(t){ const f1=document.getElementById('investment-form-step1'); if(f1)f1.addEventListener('submit',e=>{e.preventDefault();const a=parseInt(document.getElementById('invest-amount').value); document.getElementById('confirm-amount-display').innerText=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(a); document.getElementById('confirm-portfolio-name').innerText=investModalTitle.innerText; step1Div.classList.add('hidden'); step2Div.classList.remove('hidden');}); const btn=document.getElementById('btn-final-confirm'); if(btn)btn.addEventListener('click',async()=>{btn.innerText="..."; try{const r=await fetch('/api/invest',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({portfolioId:investModalIdInput.value,amount:document.getElementById('invest-amount').value,token:t})});if(r.ok){closeModal();updateUserData(t);loadPortfolios();showSuccess();fetchPersonalChart(t,'netWorth');}else{alert((await r.json()).message);window.backToStep1();}}catch{alert("Error");} btn.innerText="Confirmar";});}
function setupExtraInputs(){ /* (Igual que antes) */ }
window.initStripePayment = async function() { /* (Copia la lógica de Stripe de la respuesta anterior) */ }
window.setupInvest = function(id,n,t) { investModalTitle.innerText=n; investModalIdInput.value=id; investModal.dataset.ticket=t; window.backToStep1(); investModal.classList.remove('hidden'); setTimeout(()=>investModal.classList.remove('opacity-0'),10); document.getElementById('invest-amount').value=''; document.getElementById('invest-calculation').innerText=''; }
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(()=>investModal.classList.add('hidden'),300); }
window.showSuccess = function() { successModal.classList.remove('hidden'); setTimeout(()=>successModal.classList.remove('opacity-0'),10); }
window.closeSuccessModal = function() { successModal.classList.add('opacity-0'); setTimeout(()=>successModal.classList.add('hidden'),300); }
window.openDepositModal = function() { depositModal.classList.remove('hidden'); setTimeout(()=>depositModal.classList.remove('opacity-0'),10); }
window.closeDepositModal = function() { depositModal.classList.add('opacity-0'); setTimeout(()=>depositModal.classList.add('hidden'),300); }
window.openWithdrawModal = function() { withdrawModal.classList.remove('hidden'); setTimeout(()=>withdrawModal.classList.remove('opacity-0'),10); }
window.closeWithdrawModal = function() { withdrawModal.classList.add('opacity-0'); setTimeout(()=>withdrawModal.classList.add('hidden'),300); }