// public/js/dashboard.js
const stripe = Stripe("pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp");
let elements;
let investModal, depositModal, withdrawModal, successModal, myChart, chartDataCache;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // INIT REFS
    investModal = document.getElementById('invest-modal');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');
    successModal = document.getElementById('success-modal');

    // CALCULADORA
    initCalculator();

    // CARGA
    await updateUserData(token);
    await loadPortfolios();
    fetchPersonalChart(token, 'netWorth');

    // LISTENERS
    setupFormListeners(token);
    document.getElementById('btn-ver-todos')?.addEventListener('click', () => window.location.href = 'portfolios.html');
});

// --- GRÁFICA PERSONAL ---
function fetchPersonalChart(token, type) {
    fetch('/api/chart-data', { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(d => {
        chartDataCache = d;
        renderChart(d, type);
    }).catch(e => console.error(e));
}

window.switchChart = function(type) {
    if(!chartDataCache) return;
    // Estilos botones
    const bNet = document.getElementById('btn-networth');
    const bProf = document.getElementById('btn-profit');
    if(type === 'netWorth') {
        bNet.className = "px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-primary";
        bProf.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-500";
        document.getElementById('chart-title').innerText = "Mi Patrimonio";
    } else {
        bNet.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-500";
        bProf.className = "px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-emerald-500";
        document.getElementById('chart-title').innerText = "Mi Rendimiento";
    }
    renderChart(chartDataCache, type);
}

function renderChart(data, type) {
    const ctx = document.getElementById('marketChart');
    if(!ctx) return;
    if(myChart) myChart.destroy();

    const dataset = type === 'netWorth' ? data.netWorth : data.profit;
    const color = type === 'netWorth' ? '#307de8' : '#10b981';
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const textColor = isDark ? '#ccc' : '#666';

    myChart = new Chart(ctx, {
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
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: {display:false}, tooltip: {enabled:true} },
            scales: {
                x: { display: true, grid: {display:false}, ticks: {color:textColor, maxTicksLimit:6} },
                y: { display: true, grid: {color:gridColor}, ticks: {color:textColor, callback:v=>'$'+v} }
            }
        }
    });
}

// --- STRIPE ---
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

        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('stripe-container').classList.remove('hidden');

        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: d.clientSecret, appearance });
        const pe = elements.create('payment');
        pe.mount('#payment-element');

        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault(); e.target.innerText = "Procesando..."; e.target.disabled = true;
            const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });

            if(error) { alert(error.message); e.target.disabled=false; e.target.innerText="Pagar"; }
            else {
                await fetch('/api/deposit', {
                    method:'POST',
                    headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
                    body:JSON.stringify({amount, token:localStorage.getItem('token')})
                });
                closeDepositModal();
                updateUserData(localStorage.getItem('token'));
                window.showSuccess();
            }
        };
    } catch(e) { console.error(e); alert("Error iniciando pago"); btn.disabled=false; }
}

// --- PORTAFOLIOS & CALCULADORA ---
function initCalculator() {
    const inp = document.getElementById('invest-amount');
    if(!inp) return;
    let msg = document.getElementById('invest-calculation');
    if(!msg) { msg=document.createElement('p'); msg.id='invest-calculation'; msg.className='text-xs font-bold text-primary text-right mt-1'; inp.parentNode.appendChild(msg); }
    const btn = document.getElementById('btn-continue-invest');

    inp.addEventListener('input', (e)=>{
        const v = parseInt(e.target.value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if(!v || v<min) { msg.innerText=`Mínimo $${min}`; msg.classList.add('text-red-500'); if(btn) btn.disabled=true; }
        else if(v%min!==0) { msg.innerText=`Múltiplos de $${min}`; msg.classList.add('text-orange-500'); if(btn) btn.disabled=true; }
        else { msg.innerText=`${v/min} Cupos`; msg.classList.remove('text-red-500','text-orange-500'); if(btn) btn.disabled=false; }
    });
}

async function loadPortfolios() {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;
    const res = await fetch('/api/portfolios?t='+Date.now());
    const data = await res.json();
    grid.innerHTML = '';
    data.slice(0,3).forEach(p => {
        const rem = p.remainingTickets ?? 1000;
        const prog = Math.min(100, (p.soldTickets/p.totalTickets)*100);
        const fmt = new Intl.NumberFormat('es-MX');
        
        let color = "bg-emerald-100 text-emerald-700";
        if(rem===0) color="bg-slate-200 text-slate-500";
        else if(prog>=90) color="bg-red-100 text-red-700";

        grid.innerHTML += `
        <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full">
            <div class="flex justify-between mb-2"><div class="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">🚀</div><span class="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded uppercase">${p.risk}</span></div>
            <h3 class="font-bold text-lg dark:text-white">${p.name}</h3>
            <p class="text-xs text-slate-500 mb-4 h-8 overflow-hidden">${p.description}</p>
            <div class="flex items-center gap-2 mb-2"><span class="px-2 py-1 rounded text-[10px] font-bold ${color}">${rem===0?'AGOTADO':fmt.format(rem)+' cupos'}</span></div>
            <div class="mt-auto"><div class="w-full bg-slate-100 h-2 rounded-full mb-2"><div class="bg-primary h-2 rounded-full" style="width:${prog}%"></div></div>
            <button onclick="setupInvest(${p.id},'${p.name}',${p.minInvestment})" class="w-full py-2 rounded-lg bg-slate-900 text-white font-bold text-sm" ${rem===0?'disabled':''}>${rem===0?'Lleno':'Unirme'}</button></div>
        </div>`;
    });
}

// Helpers
async function updateUserData(t){ const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${t}`}}); if(r.ok) updateBalanceUI(await r.json()); }
function updateBalanceUI(d){ 
    const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
    const s=(i,v)=>{const e=document.getElementById(i);if(e)e.innerHTML=v;};
    s('display-net-worth',f.format(d.netWorth)); s('display-available',f.format(d.availableBalance));
    s('display-invested',f.format(d.investedAmount)); s('modal-balance-display',f.format(d.availableBalance));
}
function setupFormListeners(t){
    const f1=document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', e=>{
        e.preventDefault();
        document.getElementById('confirm-amount-display').innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(document.getElementById('invest-amount').value);
        document.getElementById('confirm-portfolio-name').innerText = document.getElementById('modal-portfolio-name').innerText;
        document.getElementById('invest-step-1').classList.add('hidden'); document.getElementById('invest-step-2').classList.remove('hidden');
    });
    const btn=document.getElementById('btn-final-confirm');
    if(btn) btn.addEventListener('click', async()=>{
        btn.innerText="Procesando...";
        try{
            const res=await fetch('/api/invest',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({portfolioId:document.getElementById('modal-portfolio-id').value,amount:document.getElementById('invest-amount').value,token:t})});
            if(res.ok){ closeModal(); updateUserData(t); loadPortfolios(); showSuccess(); fetchPersonalChart(t,'netWorth'); }
            else{ alert((await res.json()).message); window.backToStep1(); }
        }catch{alert("Error"); window.backToStep1();}
        btn.innerText="Confirmar";
    });
    const wf=document.getElementById('withdraw-form'); if(wf) wf.addEventListener('submit', async e=>{ e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{ await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({amount:a,token:t})}); window.closeWithdrawModal(); updateUserData(t); alert("Retiro OK"); fetchPersonalChart(t,'netWorth'); }catch{} });
}

// Globales
window.setupInvest = function(id,name,tik){ investModal.dataset.ticket=tik; document.getElementById('modal-portfolio-name').innerText=name; document.getElementById('modal-portfolio-id').value=id; window.backToStep1(); investModal.classList.remove('hidden'); setTimeout(()=>investModal.classList.remove('opacity-0'),10); }
window.backToStep1 = function(){ document.getElementById('invest-step-1').classList.remove('hidden'); document.getElementById('invest-step-2').classList.add('hidden'); }
window.closeModal = function(){ investModal.classList.add('opacity-0'); setTimeout(()=>investModal.classList.add('hidden'),300); }
window.showSuccess = function(){ successModal.classList.remove('hidden'); setTimeout(()=>successModal.classList.remove('opacity-0'),10); }
window.closeSuccessModal = function(){ successModal.classList.add('opacity-0'); setTimeout(()=>successModal.classList.add('hidden'),300); }
window.openDepositModal = function(){ depositModal.classList.remove('hidden'); setTimeout(()=>depositModal.classList.remove('opacity-0'),10); }
window.closeDepositModal = function(){ depositModal.classList.add('opacity-0'); setTimeout(()=>depositModal.classList.add('hidden'),300); }
window.openWithdrawModal = function(){ withdrawModal.classList.remove('hidden'); setTimeout(()=>withdrawModal.classList.remove('opacity-0'),10); }
window.closeWithdrawModal = function(){ withdrawModal.classList.add('opacity-0'); setTimeout(()=>withdrawModal.classList.add('hidden'),300); }