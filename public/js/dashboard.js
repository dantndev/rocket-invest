// public/js/dashboard.js

// 1. FUNCIONES GLOBALES (DEFINIDAS PRIMERO PARA EVITAR ERRORES DE CLIC)
window.setupInvest = function(id, name, ticket) {
    const modal = document.getElementById('invest-modal');
    if(!modal) return;
    
    // Referencias internas
    const title = document.getElementById('modal-portfolio-name');
    const idInput = document.getElementById('modal-portfolio-id');
    const calc = document.getElementById('invest-calculation');
    const amountInput = document.getElementById('invest-amount');

    // Llenar datos
    if(title) title.innerText = name;
    if(idInput) idInput.value = id;
    modal.dataset.ticket = ticket;

    // Reset UI
    if(amountInput) {
        amountInput.value = '';
        amountInput.placeholder = `Ej. ${ticket}`;
        amountInput.min = ticket;
        amountInput.step = ticket;
    }
    if(calc) {
        calc.innerText = `Mínimo $${new Intl.NumberFormat('es-MX').format(ticket)}`;
        calc.className = "text-xs font-bold text-primary text-right mt-1";
    }

    // Mostrar Modal
    window.backToStep1();
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
};

window.backToStep1 = function() {
    document.getElementById('invest-step-1').classList.remove('hidden');
    document.getElementById('invest-step-2').classList.add('hidden');
};

window.closeModal = function() {
    const modal = document.getElementById('invest-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

// --- VARIABLES ---
const stripe = Stripe("pk_test_51SVnUE4AqCfV55nwMITPJEyhmY5Kb1dXKothHnOOFJw52Z7rRZTWudxYwmkiAdu1uVqGCm2Vu61QSxmT7GeWcbMW00u7G1cvrp");
let myChart, chartDataCache;

// --- INICIO ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Cargar Datos
    await updateUserData(token);
    await loadPortfolios();
    
    // Intentar cargar gráfica personal, si falla, carga mercado
    fetchPersonalChart(token, 'netWorth');

    // Listeners
    setupFormListeners(token);
    setupExtraInputs();
    initCalculator();
});

// --- GRÁFICA BLINDADA ---
function fetchPersonalChart(token, type) {
    fetch('/api/chart-data', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
            chartDataCache = data;
            renderChart(data, type);
        })
        .catch(e => {
            console.warn("Fallo gráfica personal, usando datos default", e);
            // Datos Dummy para que no se vea vacío
            const dummy = {
                dates: [1700000000, 1701000000, 1702000000],
                netWorth: [50000, 50000, 50000],
                profit: [0, 0, 0]
            };
            chartDataCache = dummy;
            renderChart(dummy, type);
        });
}

function renderChart(data, type) {
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;

    // Destruir anterior
    if (window.myChart instanceof Chart) window.myChart.destroy();

    const dataset = type === 'netWorth' ? data.netWorth : data.profit;
    const color = type === 'netWorth' ? '#307de8' : '#10b981';
    
    // Configuración de colores
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
                    const g = c.chart.ctx.createLinearGradient(0,0,0,300);
                    g.addColorStop(0, color + '33');
                    g.addColorStop(1, color + '00');
                    return g;
                },
                borderWidth: 2,
                pointRadius: 4,        // Puntos visibles
                pointHoverRadius: 6,   // Hover más grande
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false, // Importante para que reaccione fácil
            },
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    enabled: true,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: { 
                    display: true, 
                    grid: { display: false },
                    ticks: { color: textColor, maxTicksLimit: 6 }
                },
                y: { 
                    display: true, 
                    grid: { color: gridColor },
                    ticks: { 
                        color: textColor,
                        callback: function(value) {
                            return '$' + new Intl.NumberFormat('es-MX', { notation: "compact" }).format(value);
                        }
                    }
                }
            }
        }
    });
}

window.switchChart = function(type) {
    if (!chartDataCache) return;
    renderChart(chartDataCache, type);
    
    // Toggle estilos botones
    const b1 = document.getElementById('btn-networth');
    const b2 = document.getElementById('btn-profit');
    const t = document.getElementById('chart-title');
    
    if(type === 'netWorth') {
        b1.classList.add('bg-white', 'dark:bg-card-dark', 'shadow-sm', 'text-primary');
        b1.classList.remove('text-slate-500');
        b2.classList.remove('bg-white', 'dark:bg-card-dark', 'shadow-sm', 'text-emerald-500');
        b2.classList.add('text-slate-500');
        if(t) t.innerText = "Mi Patrimonio";
    } else {
        b1.classList.remove('bg-white', 'dark:bg-card-dark', 'shadow-sm', 'text-primary');
        b1.classList.add('text-slate-500');
        b2.classList.add('bg-white', 'dark:bg-card-dark', 'shadow-sm', 'text-emerald-500');
        b2.classList.remove('text-slate-500');
        if(t) t.innerText = "Mi Rendimiento";
    }
}

// --- PORTAFOLIOS ---
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

            // Semáforo
            let badge = `bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`;
            let dot = `bg-emerald-500`;
            let status = `${remaining} cupos`;
            let disabled = "";
            let btnText = "Unirme al Grupo";

            if (remaining === 0) {
                badge = "bg-slate-200 text-slate-500"; dot = "hidden"; status = "AGOTADO"; disabled = "disabled"; btnText = "Cerrado";
            } else if (progress >= 90) {
                badge = "bg-red-100 text-red-700"; dot = "bg-red-500"; status = `¡Últimos ${remaining}!`;
            }

            const icon = ['🚀','💻','🌍','🌱','💎','🏗️','🇺🇸','🎮','🏆'][p.id-1] || '📈';
            const riskColor = p.risk === 'Alto' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50';

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300">
                <div class="flex justify-between mb-3 items-start">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">${icon}</div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${riskColor}">${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2 h-8">${p.description}</p>
                <div class="flex items-center gap-2 mb-4">
                    <span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${badge}">
                        <span class="flex h-2 w-2 rounded-full ${dot} animate-pulse"></span>${status}
                    </span>
                </div>
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Avance</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width:${progress}%"></div></div>
                    <div class="flex justify-between items-end mt-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                         <div class="flex flex-col"><span class="text-xs text-slate-400">Ticket</span><span class="text-sm font-bold text-slate-900 dark:text-white">${moneyFmt.format(p.minInvestment)}</span></div>
                         <button onclick="setupInvest(${p.id}, '${p.name}', ${p.minInvestment})" class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90" ${disabled}>${btnText}</button>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

// --- HELPERS Y FORMULARIOS ---
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) {
    const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});
    document.getElementById('display-net-worth').innerHTML=`${f.format(d.netWorth)} <span class="text-2xl font-normal">MXN</span>`;
    document.getElementById('display-available').innerText=f.format(d.availableBalance);
    document.getElementById('display-invested').innerText=f.format(d.investedAmount);
    document.getElementById('modal-balance-display').innerText=f.format(d.availableBalance);
    const p=document.getElementById('display-profit'); if(p){p.innerText=(d.profit>=0?'+':'')+f.format(d.profit);p.className=d.profit>=0?"text-emerald-500 font-bold text-lg":"text-red-500 font-bold text-lg";}
    const g=document.getElementById('user-greeting'); if(g) g.innerText=`Hola, ${d.first_name?d.first_name.split(' ')[0]:'Inversor'}`;
}

function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', e => {
        e.preventDefault();
        const am = parseInt(document.getElementById('invest-amount').value);
        const min = parseInt(document.getElementById('invest-modal').dataset.ticket || 1000);
        if(!am || am < min || am % min !== 0) return;
        document.getElementById('confirm-amount-display').innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(am);
        document.getElementById('confirm-portfolio-name').innerText = document.getElementById('modal-portfolio-name').innerText;
        window.backToStep1();
        document.getElementById('invest-step-1').classList.add('hidden');
        document.getElementById('invest-step-2').classList.remove('hidden');
    });

    const btn = document.getElementById('btn-final-confirm');
    if(btn) btn.addEventListener('click', async () => {
        btn.innerText = "Procesando...";
        try {
            const res = await fetch('/api/invest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    portfolioId: document.getElementById('modal-portfolio-id').value, 
                    amount: document.getElementById('invest-amount').value, 
                    token 
                })
            });
            if(res.ok) { 
                window.closeModal(); updateUserData(token); loadPortfolios(); window.showSuccess(); fetchPersonalChart(token,'netWorth');
            } else { 
                const d = await res.json(); alert(d.message); window.backToStep1(); 
            }
        } catch(e) { alert("Error"); window.backToStep1(); }
        btn.innerText = "Confirmar";
    });
}

function initCalculator() {
    const inp = document.getElementById('invest-amount');
    if(!inp) return;
    const btn = document.getElementById('btn-continue-invest');
    const msg = document.getElementById('invest-calculation');
    
    inp.addEventListener('input', (e) => {
        const v = parseInt(e.target.value);
        const min = parseInt(document.getElementById('invest-modal').dataset.ticket || 1000);
        if(!v || v < min) { msg.innerText=`Mínimo $${min}`; msg.style.color='red'; if(btn) btn.disabled=true; }
        else if(v % min !== 0) { msg.innerText=`Múltiplos de $${min}`; msg.style.color='orange'; if(btn) btn.disabled=true; }
        else { msg.innerText=`${v/min} Cupos`; msg.style.color='#10b981'; if(btn) btn.disabled=false; }
    });
}

function setupExtraInputs() { /* (Mismos listeners de deposit/withdraw) */ 
    const d=document.getElementById('deposit-form'); if(d) d.addEventListener('submit', async(e)=>{e.preventDefault(); /*...*/});
    const w=document.getElementById('withdraw-form'); if(w) w.addEventListener('submit', async(e)=>{e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); window.closeWithdrawModal(); updateUserData(localStorage.getItem('token')); alert("Retiro OK");}catch{}});
}

// GLOBALES EXTRAS
window.openDepositModal = function() { document.getElementById('deposit-modal')?.classList.remove('hidden'); };
window.closeDepositModal = function() { document.getElementById('deposit-modal')?.classList.add('hidden'); };
window.openWithdrawModal = function() { 
    const w = document.getElementById('withdraw-modal');
    const b = document.getElementById('modal-balance-display')?.innerText;
    if(w) { w.classList.remove('hidden'); document.getElementById('withdraw-max-balance').innerText = b; }
};
window.closeWithdrawModal = function() { document.getElementById('withdraw-modal')?.classList.add('hidden'); };
window.showSuccess = function() { document.getElementById('success-modal')?.classList.remove('hidden'); }
window.closeSuccessModal = function() { document.getElementById('success-modal')?.classList.add('hidden'); }

// STRIPE INIT
window.initStripePayment = async function() {
    const amount = document.getElementById('deposit-amount').value;
    const btn = document.getElementById('btn-init-stripe');
    if(!amount || amount<=0) return alert("Monto inválido");
    
    btn.disabled=true; btn.innerText="Cargando...";
    try {
        const res = await fetch('/api/create-payment-intent', {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},
            body:JSON.stringify({amount, token:localStorage.getItem('token')})
        });
        const d = await res.json();
        
        document.getElementById('stripe-summary-amount').innerText = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(amount);
        document.getElementById('deposit-step-1').classList.add('hidden');
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
                document.getElementById('deposit-amount').value=''; document.getElementById('deposit-step-1').classList.remove('hidden'); document.getElementById('stripe-container').classList.add('hidden');
                btn.disabled=false; btn.innerText="Iniciar";
            }
        }
    } catch(e){ alert("Error Stripe"); btn.disabled=false; }
}