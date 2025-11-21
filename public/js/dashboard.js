// public/js/dashboard.js

// STRIPE (Tu llave pública real)
const stripe = Stripe("pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp");
let elements;

let investModal, depositModal, withdrawModal, successModal;
// ... variables globales de siempre ...
let step1Div, step2Div, btnFinalConfirm, investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // INIT REFS (Igual que antes)
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

    // Calculadora Inversión (Igual que antes)
    const investInput = document.getElementById('invest-amount');
    let calcMsg = document.getElementById('invest-calculation');
    const btnContinue = document.getElementById('btn-continue-invest');
    if (investInput) {
        if (!calcMsg) { calcMsg = document.createElement('p'); calcMsg.id = 'invest-calculation'; calcMsg.className = 'text-xs font-bold text-primary text-right mt-1'; investInput.parentNode.parentNode.appendChild(calcMsg); }
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const min = parseInt(investModal.dataset.ticket || 1000);
            if (!val || val < min) { calcMsg.innerText = `Mínimo $${min}`; calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1"; if(btnContinue) btnContinue.disabled = true; }
            else if (val % min !== 0) { calcMsg.innerText = `Múltiplos de $${min}`; calcMsg.className = "text-xs font-bold text-orange-400 text-right mt-1"; if(btnContinue) btnContinue.disabled = true; }
            else { const p = val/min; calcMsg.innerText = `Adquiriendo ${p} Cupo${p>1?'s':''}`; calcMsg.className = "text-xs font-bold text-emerald-500 text-right mt-1"; if(btnContinue) btnContinue.disabled = false; }
        });
    }

    // Cargar Datos
    await updateUserData(token);
    await loadPortfolios();
    renderPersonalChart(token, 'netWorth');
    setupFormListeners(token);
});

// --- LÓGICA DE STRIPE (NUEVO) ---
window.initStripePayment = async function() {
    const amount = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    
    if(!amount || amount <= 0) { alert("Ingresa un monto válido"); return; }
    
    btn.disabled = true;
    btn.innerText = "Conectando con Banco...";

    try {
        // 1. Pedir Intent al Servidor
        const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ amount: amount, token: localStorage.getItem('token') })
        });
        const data = await res.json();
        
        if(!data.clientSecret) throw new Error("Error iniciando pago");

        // 2. Mostrar Elemento de Tarjeta
        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('stripe-container').classList.remove('hidden');

        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: data.clientSecret, appearance });
        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');

        // Listener para el botón final de pago
        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault();
            e.target.disabled = true;
            e.target.innerText = "Procesando...";

            const { error } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required' // No redirigir si no es necesario
            });

            if (error) {
                alert(error.message);
                e.target.disabled = false;
                e.target.innerText = "Pagar Ahora";
            } else {
                // Éxito en Stripe -> Avisar al Backend para sumar saldo
                await fetch('/api/deposit', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}`},
                    body: JSON.stringify({ amount: amount, token: localStorage.getItem('token') })
                });
                closeDepositModal();
                updateUserData(localStorage.getItem('token'));
                showSuccess(); // Modal verde
                document.getElementById('deposit-amount').value = '';
                // Resetear form
                document.getElementById('deposit-step-1').classList.remove('hidden');
                document.getElementById('stripe-container').classList.add('hidden');
                btn.disabled = false; btn.innerText = "Iniciar Pago Seguro";
            }
        };

    } catch (error) {
        console.error(error);
        alert("Error conectando con pasarela de pago");
        btn.disabled = false;
        btn.innerText = "Iniciar Pago Seguro";
    }
}


// ... (RESTO DEL CÓDIGO DE SIEMPRE: loadPortfolios, updateUserData, setupFormListeners...)
// (Pega aquí las mismas funciones que tenías en el dashboard.js anterior para no romper lo demás)
// Si necesitas que te las pegue todas juntas de nuevo dímelo, pero solo agregué lo de Stripe arriba.
// ...
// [AQUÍ VA EL RESTO DEL CÓDIGO - loadPortfolios, etc.]
// PARA NO CORTAR, TE LO DOY COMPLETO ABAJO:

async function loadPortfolios() { /* ... Mismo código de cupos de siempre ... */ 
    try { const res=await fetch('/api/portfolios?t='+Date.now()); const d=await res.json(); const g=document.getElementById('portfolio-grid'); if(!g)return; g.innerHTML=''; d.slice(0,3).forEach(p=>{ /* ... Mismo HTML de tarjeta ... */ 
        const t=p.totalTickets||1000;const s=p.soldTickets||0;const r=p.remainingTickets!==undefined?p.remainingTickets:1000;const pg=Math.min(100,(s/t)*100);const nf=new Intl.NumberFormat('es-MX');const mf=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});let bc="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",dc="bg-emerald-500",st=`${nf.format(r)} cupos`,dis="",bt="Unirme";if(r===0){bc="bg-slate-200 text-slate-500";dc="hidden";st="AGOTADO";dis="disabled";bt="Cerrado";}else if(pg>=90){bc="bg-red-100 text-red-700";dc="bg-red-500";st=`¡Últimos ${r}!`;} const ic=['🚀','💻','🌍','🌱','💎','🏗️','🇺🇸','🎮','🏆'][p.id-1]||'📈'; let rc=p.risk==='Alto'?'text-red-600 bg-red-50':'text-green-600 bg-green-50';
        g.innerHTML+=`<div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300"><div class="flex justify-between mb-3 items-start"><div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">${ic}</div><div class="flex flex-col items-end"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rc}">Riesgo ${p.risk}</span><span class="text-[10px] text-slate-400 mt-1">Lock: ${p.lockUpPeriod}</span></div></div><h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">${p.name}</h3><p class="text-xs text-slate-500 mb-4 line-clamp-2">${p.description}</p><div class="flex items-center gap-2 mb-4"><span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${bc}"><span class="flex h-2 w-2 rounded-full ${dc} animate-pulse"></span>${st}</span></div><div class="mt-auto"><div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Recaudado</span><span class="text-primary">${pg.toFixed(0)}%</span></div><div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width:${pg}%"></div></div><div class="flex justify-between items-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-700"><div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold text-slate-900 dark:text-white">${mf.format(p.minInvestment)}</span></div><button onclick="setupInvest(${p.id},'${p.name}',${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity" ${dis}>${bt}</button></div></div></div>`;
    }); }catch(e){}
}

async function updateUserData(token) { try{const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}});if(r.ok)updateBalanceUI(await r.json());}catch(e){} }
function updateBalanceUI(d) { const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); const s=(i,v)=>{const e=document.getElementById(i);if(e)e.innerHTML=v;}; s('display-net-worth',`${f.format(d.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`); s('display-available',f.format(d.availableBalance)); s('display-invested',f.format(d.investedAmount)); s('modal-balance-display',f.format(d.availableBalance)); const p=document.getElementById('display-profit'); if(p){p.innerText=(d.profit>=0?'+':'')+f.format(d.profit);p.className=d.profit>=0?"text-emerald-500 font-bold text-lg":"text-red-500 font-bold text-lg";} }

// Gráfica Personal
async function renderPersonalChart(token,type){ const ctx=document.getElementById('marketChart');if(!ctx)return; fetch('/api/chart-data',{headers:{'Authorization':`Bearer ${token}`}}).then(r=>r.json()).then(d=>{ const isDark=document.documentElement.classList.contains('dark'); new Chart(ctx,{type:'line',data:{labels:d.dates.map(t=>new Date(t*1000).toLocaleDateString('es-MX')),datasets:[{label:'Capital',data:type==='profit'?d.profit:d.netWorth,borderColor:'#307de8',borderWidth:2,pointRadius:0}]},options:{maintainAspectRatio:false,scales:{x:{display:false},y:{display:false}},plugins:{legend:{display:false}}}}); }); }
window.switchChart=function(t){renderPersonalChart(localStorage.getItem('token'),t);}

function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1'); if(f1) f1.addEventListener('submit', e=>{e.preventDefault();const a=parseInt(document.getElementById('invest-amount').value); const m=parseInt(investModal.dataset.ticket||1000); if(!a||a<m||a%m!==0)return; document.getElementById('confirm-amount-display').innerText=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(a); document.getElementById('confirm-portfolio-name').innerText=investModalTitle.innerText; step1Div.classList.add('hidden'); step2Div.classList.remove('hidden');});
    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async()=>{btnFinalConfirm.innerText="Procesando..."; try{const r=await fetch('/api/invest',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({portfolioId:investModalIdInput.value,amount:document.getElementById('invest-amount').value,token})});if(r.ok){closeModal();updateUserData(token);loadPortfolios();showSuccess();}else{const d=await r.json();alert(d.message);backToStep1();}}catch(e){alert("Error");backToStep1();} btnFinalConfirm.innerText="Confirmar";});
    // Withdraw (simple)
    const w=document.getElementById('withdraw-form'); if(w) w.addEventListener('submit', async(e)=>{e.preventDefault();const a=document.getElementById('withdraw-amount').value;try{await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount:a,token})});closeWithdrawModal();updateUserData(token);alert("Retiro OK");}catch(e){}});
}

// Globales
window.setupInvest = function(id, name, ticket) { if(!investModal) return; investModalTitle.innerText = name; investModalIdInput.value = id; investModal.dataset.ticket = ticket; backToStep1(); investModal.classList.remove('hidden'); setTimeout(() => { investModal.classList.remove('opacity-0'); investModal.querySelector('div').classList.add('scale-100'); }, 10); const inp = document.getElementById('invest-amount'); if(inp) { inp.value = ''; inp.placeholder = `Ej. ${ticket}`; inp.step = ticket; inp.min = ticket; } const msg = document.getElementById('invest-calculation'); if(msg) msg.innerText = ''; }
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.showSuccess = function() { if(successModal) { successModal.classList.remove('hidden'); setTimeout(() => { successModal.classList.remove('opacity-0'); successModal.querySelector('div').classList.add('scale-100'); }, 10); } }
window.closeSuccessModal = function() { if(successModal) { successModal.classList.add('opacity-0'); setTimeout(() => successModal.classList.add('hidden'), 300); } }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};