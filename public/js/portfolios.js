// public/js/dashboard.js
const stripeKey = "pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp";
const stripe = Stripe(stripeKey);
let elements, myChart, chartDataCache;

// --- FUNCIONES GLOBALES EXPORTADAS AL WINDOW ---
window.setupInvest = function(id, name, ticket) {
    const modal = document.getElementById('invest-modal');
    if(!modal) return;
    
    document.getElementById('modal-portfolio-name').innerText = name;
    document.getElementById('modal-portfolio-id').value = id;
    modal.dataset.ticket = ticket;

    // Reset visual
    document.getElementById('invest-step-1').classList.remove('hidden');
    document.getElementById('invest-step-2').classList.add('hidden');

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        // Si existe un div interno para animar escala
        const inner = modal.querySelector('div');
        if(inner) inner.classList.add('scale-100');
    }, 10);

    const inp = document.getElementById('invest-amount');
    const msg = document.getElementById('invest-calculation');
    if(inp) { inp.value = ''; inp.placeholder = `Ej. ${ticket}`; inp.min = ticket; inp.step = ticket; }
    if(msg) { msg.innerText = `Mínimo $${ticket.toLocaleString('es-MX')}`; }
};

window.initStripePayment = async function() {
    const amount = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    
    if(!amount || amount <= 0) { alert("Monto inválido"); return; }
    
    btn.disabled = true; btn.innerText = "Conectando...";
    
    try {
        const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
            body: JSON.stringify({amount, token:localStorage.getItem('token')})
        });
        const d = await res.json();
        if(d.error) throw new Error(d.error);

        document.getElementById('stripe-summary-amount').innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(amount);
        document.getElementById('btn-init-stripe').classList.add('hidden'); // Ocultar botón iniciar
        document.getElementById('stripe-container').classList.remove('hidden');

        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: d.clientSecret, appearance });
        const pe = elements.create('payment'); pe.mount('#payment-element');

        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault(); e.target.innerText="Procesando..."; e.target.disabled=true;
            const {error} = await stripe.confirmPayment({elements, redirect:'if_required'});
            if(error) { alert(error.message); e.target.disabled=false; }
            else {
                await fetch('/api/deposit', {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount,token:localStorage.getItem('token')})});
                window.closeDepositModal(); updateUserData(localStorage.getItem('token')); window.showSuccess();
                // Reset UI
                document.getElementById('deposit-amount').value=''; 
                document.getElementById('btn-init-stripe').classList.remove('hidden');
                document.getElementById('stripe-container').classList.add('hidden');
                btn.disabled=false; btn.innerText="Iniciar Pago Seguro";
                fetchPersonalChart(localStorage.getItem('token'), 'netWorth');
            }
        };
    } catch(e) { console.error(e); alert("Error Stripe"); btn.disabled=false; btn.innerText="Iniciar"; }
};

// Modales
window.backToStep1 = function() { document.getElementById('invest-step-1').classList.remove('hidden'); document.getElementById('invest-step-2').classList.add('hidden'); }
window.closeModal = function() { const m=document.getElementById('invest-modal'); m.classList.add('opacity-0'); setTimeout(()=>m.classList.add('hidden'),300); }
window.showSuccess = function() { const m=document.getElementById('success-modal'); m.classList.remove('hidden'); setTimeout(()=>m.classList.remove('opacity-0'),10); }
window.closeSuccessModal = function() { const m=document.getElementById('success-modal'); m.classList.add('opacity-0'); setTimeout(()=>m.classList.add('hidden'),300); }
window.openDepositModal = function() { const m=document.getElementById('deposit-modal'); m.classList.remove('hidden'); setTimeout(()=>m.classList.remove('opacity-0'),10); }
window.closeDepositModal = function() { const m=document.getElementById('deposit-modal'); m.classList.add('opacity-0'); setTimeout(()=>m.classList.add('hidden'),300); }
window.openWithdrawModal = function() { const m=document.getElementById('withdraw-modal'); if(m){const b=document.getElementById('modal-balance-display')?.innerText||"0";document.getElementById('withdraw-max-balance').innerText=b;m.classList.remove('hidden');setTimeout(()=>m.classList.remove('opacity-0'),10);} }
window.closeWithdrawModal = function() { const m=document.getElementById('withdraw-modal'); m.classList.add('opacity-0'); setTimeout(()=>m.classList.add('hidden'),300); }


// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    initCalculator();
    await updateUserData(token);
    await loadPortfolios();
    fetchPersonalChart(token, 'netWorth');

    document.getElementById('btn-ver-todos')?.addEventListener('click', () => window.location.href = 'portfolios.html');
    setupFormListeners(token);
    setupExtraInputs();
});

async function loadPortfolios() {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;
    try {
        const res = await fetch('/api/portfolios?t='+Date.now());
        const data = await res.json();
        grid.innerHTML = '';
        // SIN SLICE (Para mostrar todos en Explorar)
        data.forEach(p => {
             // ... COPIA EL MISMO BLOQUE DEL FOR-EACH DE DASHBOARD.JS ...
        });
    } catch(e){}
}
// El resto de funciones globales son idénticas

function fetchPersonalChart(token,type){ const ctx=document.getElementById('marketChart'); if(!ctx)return; fetch('/api/chart-data',{headers:{'Authorization':`Bearer ${token}`}}).then(r=>r.json()).then(d=>{chartDataCache=d;renderChart(d,type)}).catch(e=>{}); }
window.switchChart=function(t){if(!chartDataCache)return;renderChart(chartDataCache,t);}
function renderChart(d,t){
    const ctx=document.getElementById('marketChart'); if(window.myChart) window.myChart.destroy();
    const ds=t==='netWorth'?d.netWorth:d.profit; const cl=t==='netWorth'?'#307de8':'#10b981';
    window.myChart=new Chart(ctx,{type:'line',data:{labels:d.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX')),datasets:[{data:ds,borderColor:cl,borderWidth:2,pointRadius:3,pointHitRadius:20,fill:true,backgroundColor:cl+'33'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{enabled:true}},scales:{x:{display:true,grid:{display:false}},y:{display:true}}}});
}
function initCalculator(){ const inp=document.getElementById('invest-amount'); if(inp) inp.addEventListener('input',e=>{const v=parseInt(e.target.value);const min=parseInt(document.getElementById('invest-modal').dataset.ticket||1000); const msg=document.getElementById('invest-calculation'); if(!v||v<min){msg.innerText=`Mín $${min}`;msg.style.color='red';}else if(v%min!==0){msg.innerText=`Múltiplos $${min}`;msg.style.color='orange';}else{msg.innerText=`${v/min} Cupos`;msg.style.color='green';}}); }
function setupFormListeners(token) {
    const f1=document.getElementById('investment-form-step1');
    if(f1)f1.addEventListener('submit',e=>{e.preventDefault();document.getElementById('confirm-amount-display').innerText=document.getElementById('invest-amount').value;document.getElementById('confirm-portfolio-name').innerText=document.getElementById('modal-portfolio-name').innerText;window.backToStep1();document.getElementById('invest-step-1').classList.add('hidden');document.getElementById('invest-step-2').classList.remove('hidden');});
    const btn=document.getElementById('btn-final-confirm');
    if(btn)btn.addEventListener('click',async()=>{btn.innerText="...";try{const r=await fetch('/api/invest',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({portfolioId:document.getElementById('modal-portfolio-id').value,amount:document.getElementById('invest-amount').value,token})});if(r.ok){window.closeModal();updateUserData(token);loadPortfolios();window.showSuccess();fetchPersonalChart(token,'netWorth');}else{alert((await r.json()).message);window.backToStep1();}}catch{alert("Error");window.backToStep1();}btn.innerText="Confirmar";});
}
function setupExtraInputs(){ const w=document.getElementById('withdraw-form'); if(w)w.addEventListener('submit',async e=>{e.preventDefault();try{await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:document.getElementById('withdraw-amount').value,token:localStorage.getItem('token')})});window.closeWithdrawModal();updateUserData(localStorage.getItem('token'));alert("Retiro OK");}catch{}}); }
async function updateUserData(t){try{const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${t}`}});if(r.ok)updateBalanceUI(await r.json());}catch{}}
function updateBalanceUI(d){const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});document.getElementById('display-net-worth').innerHTML=f.format(d.netWorth);document.getElementById('display-available').innerText=f.format(d.availableBalance);document.getElementById('display-invested').innerText=f.format(d.investedAmount);document.getElementById('modal-balance-display').innerText=f.format(d.availableBalance);document.getElementById('user-greeting').innerText=`Hola, ${d.first_name?d.first_name.split(' ')[0]:'Inversor'}`;}