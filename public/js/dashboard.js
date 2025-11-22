// public/js/dashboard.js

// 1. INICIALIZACIÓN GLOBAL DE STRIPE (Fuera de todo evento para que exista siempre)
const stripeKey = "pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp";
const stripe = Stripe(stripeKey);
let elements;

// Variables Globales UI
let investModal, depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;
let myChart, chartDataCache;

// 2. CARGA DEL DOM
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

    // Carga de Datos en Paralelo (Para que si falla uno, no detenga al otro)
    await Promise.allSettled([
        updateUserData(token),
        loadPortfolios(), // Carga las tarjetas
        fetchPersonalChart(token, 'netWorth') // Carga la gráfica
    ]);

    // Listeners
    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');
    
    setupFormListeners(token);
    setupExtraInputs();
});

// --- 3. FUNCIONES GLOBALES (ACCESIBLES DESDE HTML) ---

// A) INVERTIR (Unirme al Grupo)
window.setupInvest = function(id, name, ticket) {
    if(!investModal) return;
    
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.dataset.ticket = ticket;
    
    // Resetear visualmente
    const step1 = document.getElementById('invest-step-1');
    const step2 = document.getElementById('invest-step-2');
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    
    const inp = document.getElementById('invest-amount');
    const msg = document.getElementById('invest-calculation');
    
    if(inp) {
        inp.value = '';
        inp.placeholder = `Ej. ${ticket}`;
        inp.min = ticket;
        inp.step = ticket;
    }
    if(msg) {
        msg.innerText = `Mínimo $${new Intl.NumberFormat('es-MX').format(ticket)}`;
        msg.className = "text-xs font-bold text-primary text-right mt-1";
    }

    // Mostrar
    investModal.classList.remove('hidden');
    setTimeout(() => {
        investModal.classList.remove('opacity-0');
        // Animación del contenido interno si existe
        const inner = investModal.querySelector('div');
        if(inner) inner.classList.add('scale-100');
    }, 10);
};

// B) DEPOSITAR CON STRIPE
window.initStripePayment = async function() {
    const amountVal = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    
    if(!amountVal || amountVal <= 0) { alert("Monto inválido"); return; }
    
    btn.disabled = true; 
    btn.innerText = "Conectando...";

    try {
        const res = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                amount: amountVal, 
                token: localStorage.getItem('token')
            })
        });

        if (!res.ok) throw new Error(`Error servidor: ${res.status}`);
        
        const d = await res.json();
        if(d.error) throw new Error(d.error);

        // Preparar UI
        document.getElementById('stripe-summary-amount').innerText = new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(amountVal);
        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('stripe-container').classList.remove('hidden');

        // Montar Stripe
        const appearance = { theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe' };
        elements = stripe.elements({ clientSecret: d.clientSecret, appearance });
        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');

        // Listener del Botón Pagar (Interno)
        document.getElementById('btn-confirm-stripe').onclick = async (e) => {
            e.preventDefault();
            e.target.disabled = true;
            e.target.innerText = "Procesando...";

            const { error } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required'
            });

            if (error) {
                alert(error.message);
                e.target.disabled = false;
                e.target.innerText = "Pagar Ahora";
            } else {
                // Confirmar al backend
                await fetch('/api/deposit', {
                    method:'POST',
                    headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
                    body:JSON.stringify({amount: amountVal, token:localStorage.getItem('token')})
                });
                
                window.closeDepositModal();
                updateUserData(localStorage.getItem('token'));
                window.showSuccess();
                
                // Reset
                document.getElementById('deposit-amount').value = '';
                document.getElementById('deposit-step-1').classList.remove('hidden');
                document.getElementById('stripe-container').classList.add('hidden');
                btn.disabled = false; 
                btn.innerText = "Iniciar Pago Seguro";
                
                fetchPersonalChart(localStorage.getItem('token'), 'netWorth');
            }
        };

    } catch(e) { 
        console.error(e); 
        alert("Error de conexión con Stripe: " + e.message); 
        btn.disabled = false; 
        btn.innerText = "Iniciar Pago Seguro"; 
    }
};

// --- 4. CARGAR PORTAFOLIOS (DASHBOARD) ---
async function loadPortfolios() {
    const grid = document.getElementById('portfolio-grid');
    if(!grid) return;

    try {
        const res = await fetch('/api/portfolios?t=' + Date.now());
        const data = await res.json();
        grid.innerHTML = '';

        // Mostrar solo 3
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
            const icon = icons[(p.id-1)%icons.length] || '📈';
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
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width:${progress}%"></div></div>
                    <div class="flex justify-between items-end mt-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                         <div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold text-slate-900 dark:text-white">${moneyFmt.format(p.minInvestment)}</span></div>
                         <button onclick="setupInvest(${p.id}, '${p.name}', ${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50" ${disabled}>${btnText}</button>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { console.error("Error portfolios:", e); }
}

// --- GRÁFICA PERSONAL ---
function fetchPersonalChart(token, type) {
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;
    
    fetch('/api/chart-data', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
            chartDataCache = data;
            renderChart(data, type);
        })
        .catch(e => console.error("Error chart:", e));
}

window.switchChart = function(type) {
    if (!chartDataCache) return;
    const btnNet = document.getElementById('btn-networth');
    const btnProf = document.getElementById('btn-profit');
    const title = document.getElementById('chart-title');

    // Reset estilos
    btnNet.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-all";
    btnProf.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-all";

    if (type === 'netWorth') {
        btnNet.className = "px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-primary transition-all";
        if(title) title.innerText = "Mi Patrimonio";
    } else {
        btnProf.className = "px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-card-dark shadow-sm text-emerald-500 transition-all";
        if(title) title.innerText = "Mi Rendimiento";
    }
    renderChart(chartDataCache, type);
}

function renderChart(data, type) {
    const ctx = document.getElementById('marketChart');
    if (window.myChart instanceof Chart) window.myChart.destroy();

    const dataset = type === 'netWorth' ? data.netWorth : data.profit;
    const color = type === 'netWorth' ? '#307de8' : '#10b981';
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates.map(ts => new Date(ts*1000).toLocaleDateString('es-MX', {day:'numeric', month:'short'})),
            datasets: [{
                data: dataset,
                borderColor: color,
                backgroundColor: (c) => {
                    const g = c.chart.ctx.createLinearGradient(0,0,0,250);
                    g.addColorStop(0, color + '33');
                    g.addColorStop(1, color + '00');
                    return g;
                },
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (c) => '$ ' + new Intl.NumberFormat('es-MX').format(c.parsed.y)
                    }
                }
            },
            scales: {
                x: { display: true, grid: {display:false}, ticks: {color:textColor, maxTicksLimit:6} },
                y: { display: true, grid: {color:gridColor}, ticks: {color:textColor, callback:v=>'$'+v} }
            }
        }
    });
}

// --- UTILS ---
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) {
    const f = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const s = (i, v) => { const el = document.getElementById(i); if(el) el.innerHTML = v; };
    s('display-net-worth', `${f.format(d.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    s('display-available', f.format(d.availableBalance));
    s('display-invested', f.format(d.investedAmount));
    s('modal-balance-display', f.format(d.availableBalance));
    s('withdraw-max-balance', f.format(d.availableBalance));
    const g = document.getElementById('user-greeting'); 
    if(g) g.innerText = `Hola, ${d.first_name ? d.first_name.split(' ')[0] : 'Inversor'}`;
}

function initCalculator() {
    const inp = document.getElementById('invest-amount');
    if(!inp) return;
    const msg = document.getElementById('invest-calculation');
    const btn = document.getElementById('btn-continue-invest');
    
    inp.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if (!val || val < min) { msg.innerText=`Mín $${min}`; msg.style.color='red'; if(btn) btn.disabled=true; }
        else if (val % min !== 0) { msg.innerText=`Múltiplos de $${min}`; msg.style.color='orange'; if(btn) btn.disabled=true; }
        else { msg.innerText=`${val/min} Cupos`; msg.style.color='#10b981'; if(btn) btn.disabled=false; }
    });
}

function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', e => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if(!amount || amount < min || amount % min !== 0) return;
        document.getElementById('confirm-amount-display').innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        window.backToStep1();
        document.getElementById('invest-step-1').classList.add('hidden');
        document.getElementById('invest-step-2').classList.remove('hidden');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        try {
            const res = await fetch('/api/invest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ portfolioId: investModalIdInput.value, amount: document.getElementById('invest-amount').value, token })
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
        } catch(e) { alert("Error"); window.backToStep1(); }
        btnFinalConfirm.innerText = "Confirmar";
    });
}

function setupExtraInputs() {
    const c = document.getElementById('card-number'); if(c) c.addEventListener('input', e=>e.target.value=e.target.value.replace(/\D/g,'').substring(0,16).match(/.{1,4}/g)?.join(' ')||e.target.value);
    const ex = document.getElementById('card-expiry'); if(ex) ex.addEventListener('input', e=>{let v=e.target.value.replace(/\D/g,''); if(v.length>2) v=v.substring(0,2)+'/'+v.substring(2,4); e.target.value=v;});
    const w = document.getElementById('withdraw-form'); if(w) w.addEventListener('submit', async(e)=>{ e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{ await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); window.closeWithdrawModal(); updateUserData(localStorage.getItem('token')); alert("Retiro OK"); }catch{} });
}

// Funciones de Modal (Globales)
window.backToStep1 = function() { document.getElementById('invest-step-1').classList.remove('hidden'); document.getElementById('invest-step-2').classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.showSuccess = function() { if(successModal) { successModal.classList.remove('hidden'); setTimeout(() => successModal.classList.remove('opacity-0'), 10); } }
window.closeSuccessModal = function() { if(successModal) { successModal.classList.add('opacity-0'); setTimeout(() => successModal.classList.add('hidden'), 300); } }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { const b = document.getElementById('modal-balance-display')?.innerText || "0"; document.getElementById('withdraw-max-balance').innerText = b; withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};