// public/js/dashboard.js

// Variables globales de control
let btnFinalConfirm;
let step1Div, step2Div;
let confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Referencias estáticas
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    btnFinalConfirm = document.getElementById('btn-final-confirm');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');

    // Inicializar Calculadora
    initCalculator();

    // Carga de Datos
    await updateUserData(token);
    await loadPortfolios();
    renderMarketChart();

    // Listeners
    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');
    
    setupFormListeners(token);
    setupExtraInputs();
});

// --- 1. FUNCIÓN PARA ABRIR EL MODAL (CORREGIDA) ---
window.setupInvest = function(id, name, ticket) {
    console.log("Intentando abrir inversión:", { id, name, ticket });
    
    // Buscamos el modal aquí mismo para asegurar que existe
    const modal = document.getElementById('invest-modal');
    const title = document.getElementById('modal-portfolio-name');
    const idInput = document.getElementById('modal-portfolio-id');
    const amountInput = document.getElementById('invest-amount');
    const calcMsg = document.getElementById('invest-calculation');
    
    if (!modal) {
        console.error("❌ Error: No se encontró el modal con ID 'invest-modal'");
        return;
    }

    // Llenar datos
    if(title) title.innerText = name;
    if(idInput) idInput.value = id;
    
    // Guardar precio del ticket en el modal para validaciones
    modal.dataset.ticket = ticket;

    // Resetear formulario
    window.backToStep1();
    if(amountInput) {
        amountInput.value = '';
        amountInput.placeholder = `Ej. ${ticket}`;
        amountInput.min = ticket;
        amountInput.step = ticket;
    }
    if(calcMsg) {
        calcMsg.innerText = `Mínimo $${ticket.toLocaleString('es-MX')}`;
        calcMsg.className = "text-xs font-bold text-primary text-right mt-1";
    }

    // Mostrar
    modal.classList.remove('hidden');
    // Pequeño delay para la animación de opacidad
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const content = modal.querySelector('div'); 
        if(content) content.classList.add('scale-100');
    }, 10);
};

window.closeModal = function() {
    const modal = document.getElementById('invest-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const content = modal.querySelector('div');
    if(content) content.classList.remove('scale-100');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.backToStep1 = function() {
    const s1 = document.getElementById('invest-step-1');
    const s2 = document.getElementById('invest-step-2');
    if(s1 && s2) {
        s1.classList.remove('hidden');
        s2.classList.add('hidden');
    }
};

// --- 2. CARGA DE PORTAFOLIOS (DISEÑO DE CUPOS) ---
async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios?t=' + Date.now()); // No-cache
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        // SOLO LOS PRIMEROS 3
        data.slice(0, 3).forEach(p => {
            // Cálculos seguros
            const totalTickets = p.totalTickets || 1000;
            const soldTickets = p.soldTickets || 0;
            const remaining = (p.remainingTickets !== undefined) ? p.remainingTickets : (totalTickets - soldTickets);
            const progress = Math.min(100, (soldTickets / totalTickets) * 100);
            
            const numFormat = new Intl.NumberFormat('es-MX');
            const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

            // Semáforo
            let badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
            let dotClass = "bg-emerald-500";
            let statusText = `${numFormat.format(remaining)} cupos disp.`;
            let disabled = "";
            let btnText = "Unirme al Grupo";

            if (remaining === 0) {
                badgeClass = "bg-slate-200 text-slate-500"; 
                dotClass = "hidden"; 
                statusText = "AGOTADO"; 
                disabled = "disabled"; 
                btnText = "Cerrado";
            } else if (progress >= 90) { 
                badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"; 
                dotClass = "bg-red-500"; 
                statusText = `¡Últimos ${remaining} lugares!`;
            }

            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(p.id - 1) % icons.length] || '📈';
            const riskColor = p.risk === 'Alto' ? 'text-red-600 bg-red-50' : (p.risk === 'Bajo' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50');

            // HTML Tarjeta
            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                <div class="flex justify-between mb-3 items-start relative z-10">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-300">${icon}</div>
                    <div class="flex flex-col items-end">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${riskColor} border border-slate-100 dark:border-slate-700 leading-none">Riesgo ${p.risk}</span>
                        <span class="text-[10px] text-slate-400 mt-1">Lock: ${p.lockUpPeriod}</span>
                    </div>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1 leading-tight relative z-10">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2 h-8 relative z-10">${p.description}</p>
                
                <div class="flex items-center gap-2 mb-4 relative z-10">
                    <span class="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-2 ${badgeClass}">
                        <span class="flex h-2 w-2 rounded-full ${dotClass} animate-pulse"></span>
                        ${statusText}
                    </span>
                </div>

                <div class="mt-auto relative z-10">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Recaudado</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full transition-all duration-1000" style="width: ${progress}%"></div></div>
                    
                    <div class="flex justify-between items-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                         <div class="flex flex-col">
                            <span class="text-xs text-slate-400">Ticket</span>
                            <span class="text-sm font-bold text-slate-900 dark:text-white">${moneyFmt.format(p.minInvestment)}</span>
                         </div>
                         <button onclick="setupInvest(${p.id}, '${p.name}', ${p.minInvestment})" 
                            class="px-6 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" 
                            ${disabled}>
                            ${btnText}
                         </button>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

// --- 3. FORMULARIO Y CALCULADORA ---
function initCalculator() {
    const investInput = document.getElementById('invest-amount');
    let calcMsg = document.getElementById('invest-calculation');
    const btnContinue = document.getElementById('btn-continue-invest');

    if(!investInput) return;
    if (!calcMsg) {
        calcMsg = document.createElement('p');
        calcMsg.id = 'invest-calculation';
        calcMsg.className = 'text-xs font-bold text-primary text-right mt-1';
        investInput.parentNode.parentNode.appendChild(calcMsg);
    }

    investInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const modal = document.getElementById('invest-modal');
        const min = parseInt(modal.dataset.ticket || 1000);

        if (!val || val < min) {
            calcMsg.innerText = `Mínimo $${min.toLocaleString('es-MX')}`;
            calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1";
            if(btnContinue) btnContinue.disabled = true;
        } else if (val % min !== 0) {
            calcMsg.innerText = `Múltiplos de $${min.toLocaleString('es-MX')}`;
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

function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        const modal = document.getElementById('invest-modal');
        const min = parseInt(modal.dataset.ticket || 1000);
        
        if(!amount || amount < min || amount % min !== 0) return;
        
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
        if(confirmAmountDisplay) confirmAmountDisplay.innerText = fmt.format(amount);
        if(confirmPortfolioName) confirmPortfolioName.innerText = investModalTitle.innerText;
        
        window.backToStep1(); // Asegura estado limpio
        step1Div.classList.add('hidden');
        step2Div.classList.remove('hidden');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        const pid = document.getElementById('modal-portfolio-id').value;
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
            } else { 
                const d = await res.json(); alert(d.message); window.backToStep1(); 
            }
        } catch(e) { alert("Error de red"); window.backToStep1(); }
        btnFinalConfirm.innerText = "Confirmar";
    });
}

// --- HELPERS EXTRA ---
function setupExtraInputs() {
    const dep = document.getElementById('deposit-form'); if(dep) dep.addEventListener('submit', async(e)=>{ e.preventDefault(); const a=document.getElementById('deposit-amount').value; try{ const r=await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); if(r.ok){window.closeDepositModal();updateUserData(localStorage.getItem('token'));document.getElementById('deposit-amount').value='';alert("Depósito Exitoso");} }catch(e){} });
    const wit = document.getElementById('withdraw-form'); if(wit) wit.addEventListener('submit', async(e)=>{ e.preventDefault(); const a=document.getElementById('withdraw-amount').value; try{ const r=await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({amount:a,token:localStorage.getItem('token')})}); if(r.ok){window.closeWithdrawModal();updateUserData(localStorage.getItem('token'));document.getElementById('withdraw-amount').value='';alert("Retiro Exitoso");} }catch(e){} });
    const cIn = document.getElementById('card-number'); if(cIn) cIn.addEventListener('input', e => e.target.value=e.target.value.replace(/\D/g,'').substring(0,16).match(/.{1,4}/g)?.join(' ')||e.target.value);
    const eIn = document.getElementById('card-expiry'); if(eIn) eIn.addEventListener('input', e => { let v=e.target.value.replace(/\D/g,''); if(v.length>2) v=v.substring(0,2)+'/'+v.substring(2,4); e.target.value=v; });
}
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) {
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.innerHTML = v; };
    set('display-net-worth', `${fmt.format(d.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`);
    set('display-available', fmt.format(d.availableBalance));
    set('display-invested', fmt.format(d.investedAmount));
    set('modal-balance-display', fmt.format(d.availableBalance));
    set('withdraw-max-balance', fmt.format(d.availableBalance));
}
function renderMarketChart() { 
    const ctx = document.getElementById('marketChart'); if(!ctx) return;
    try { fetch('/api/market').then(r=>r.json()).then(d=>{ 
        const isDark = document.documentElement.classList.contains('dark'); const color = isDark ? '#94a3b8' : '#64748b';
        new Chart(ctx, { type: 'line', data: { labels: d.dates.map(t=>new Date(t*1000).toLocaleDateString('es-MX')), datasets: [{ label:'S&P 500', data:d.prices, borderColor:'#307de8', borderWidth:2, pointRadius:0 }] }, options: { maintainAspectRatio:false, plugins: { legend: {display:false} }, scales: { x: {display:false}, y: {display:false} } } }); 
    }); } catch(e){} 
}

// Modales Extra
window.openDepositModal = function() { const m=document.getElementById('deposit-modal'); if(m){m.classList.remove('hidden');setTimeout(()=>m.classList.remove('opacity-0'),10);} };
window.closeDepositModal = function() { const m=document.getElementById('deposit-modal'); if(m){m.classList.add('opacity-0');setTimeout(()=>m.classList.add('hidden'),300);} };
window.openWithdrawModal = function() { const m=document.getElementById('withdraw-modal'); if(m){const b=document.getElementById('display-available')?.innerText||"0"; document.getElementById('withdraw-max-balance').innerText=b; m.classList.remove('hidden');setTimeout(()=>m.classList.remove('opacity-0'),10);} };
window.closeWithdrawModal = function() { const m=document.getElementById('withdraw-modal'); if(m){m.classList.add('opacity-0');setTimeout(()=>m.classList.add('hidden'),300);} };
window.showSuccess = function() { const m=document.getElementById('success-modal'); if(m){m.classList.remove('hidden');setTimeout(()=>{m.classList.remove('opacity-0');m.querySelector('div').classList.add('scale-100')},10);} };
window.closeSuccessModal = function() { const m=document.getElementById('success-modal'); if(m){m.classList.add('opacity-0');m.querySelector('div').classList.remove('scale-100');setTimeout(()=>m.classList.add('hidden'),300);} };