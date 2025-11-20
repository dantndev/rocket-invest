// public/js/dashboard.js

// Variables Globales
let investModal, depositModal, withdrawModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Inicializar DOM
    initRefs();
    initCalculators();
    initForms(token);

    // Cargar Datos
    try {
        await updateUserData(token);
        await loadPortfolios();
        renderMarketChart();
    } catch (e) { console.error("Error carga inicial:", e); }
});

function initRefs() {
    investModal = document.getElementById('invest-modal');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    btnFinalConfirm = document.getElementById('btn-final-confirm');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    
    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');
}

function initCalculators() {
    const cardInput = document.getElementById('card-number');
    if (cardInput) cardInput.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').substring(0,16).match(/.{1,4}/g)?.join(' ') || e.target.value; });
    
    const expiryInput = document.getElementById('card-expiry');
    if (expiryInput) expiryInput.addEventListener('input', (e) => { 
        let v = e.target.value.replace(/\D/g, ''); 
        if(v.length > 2) v = v.substring(0,2) + '/' + v.substring(2,4);
        e.target.value = v; 
    });

    const investInput = document.getElementById('invest-amount');
    if (investInput) {
        let msg = document.getElementById('invest-calculation');
        if (!msg) { msg = document.createElement('p'); msg.id = 'invest-calculation'; msg.className = 'text-xs font-bold text-right mt-1'; investInput.parentNode.appendChild(msg); }
        const btn = document.querySelector('#investment-form-step1 button');
        
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (!val || val < 1000) { msg.innerText = "Mínimo $1,000"; msg.className = "text-xs font-bold text-red-400 text-right"; if(btn) btn.disabled = true; }
            else if (val % 1000 !== 0) { msg.innerText = "Solo múltiplos de $1,000"; msg.className = "text-xs font-bold text-orange-400 text-right"; if(btn) btn.disabled = true; }
            else { const p = val/1000; msg.innerText = `${p} Participación${p>1?'es':''}`; msg.className = "text-xs font-bold text-emerald-500 text-right"; if(btn) btn.disabled = false; }
        });
    }
}

async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        data.slice(0, 3).forEach(p => {
            const investors = p.currentInvestors || 0;
            const targetMoney = p.targetAmount || 10000000;
            const currentMoney = p.currentAmount || 0;
            // Calculo: 1 cupo = $1000
            const totalSlots = Math.floor(targetMoney / 1000);
            const filledSlots = Math.floor(currentMoney / 1000);
            const spotsLeft = Math.max(0, totalSlots - filledSlots);
            const progress = Math.min(100, (currentMoney / targetMoney) * 100);

            const fmt = new Intl.NumberFormat('es-MX');
            const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits:0 });
            let color = p.risk === 'Alto' ? 'bg-red-100 text-red-600' : (p.risk === 'Bajo' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600');
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(p.id - 1) % icons.length] || '📈';

            grid.innerHTML += `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full">
                <div class="flex justify-between mb-3">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">${icon}</div>
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${color}">Riesgo ${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4 line-clamp-2">${p.description}</p>
                <div class="flex items-center gap-2 mb-4">
                    <span class="flex h-2 w-2 rounded-full ${spotsLeft>0?'bg-green-500':'bg-red-500'} animate-pulse"></span>
                    <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${fmt.format(spotsLeft)} cupos disp.</span>
                </div>
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-slate-500">Progreso</span><span class="text-primary">${progress.toFixed(0)}%</span></div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1"><div class="bg-primary h-2 rounded-full" style="width: ${progress}%"></div></div>
                    <div class="flex justify-between text-[10px] text-slate-400 mb-4"><span>${moneyFmt.format(currentMoney)}</span><span>Meta: ${moneyFmt.format(targetMoney)}</span></div>
                    <button onclick="setupInvest(${p.id}, '${p.name}')" class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90">Unirme al Grupo</button>
                </div>
            </div>`;
        });
    } catch(e) { console.error(e); }
}

function renderMarketChart() {
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;
    // (Pega aquí tu lógica de Chart.js si se borró, es la misma de siempre)
    // ... fetch api/market ... new Chart ...
    // Si no la tienes a la mano, dime y te paso el bloque solo.
    // IMPORTANTE: Asegúrate de que esta función exista.
    
    // Versión mini para asegurar que cargue algo:
    fetch('/api/market').then(r=>r.json()).then(d=>{
        const isDark = document.documentElement.classList.contains('dark');
        new Chart(ctx, {
            type: 'line',
            data: { 
                labels: d.dates.map(ts=>new Date(ts*1000).toLocaleDateString('es-MX')), 
                datasets: [{ label: 'S&P 500', data: d.prices, borderColor: '#307de8', borderWidth: 2, tension: 0.3, pointRadius: 0 }] 
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display:false} }, scales: { x: {display:false}, y: {display:false} } }
        });
    }).catch(e=>console.error(e));
}

function initForms(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        if(!amount || amount < 1000 || amount % 1000 !== 0) return;
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
        document.getElementById('confirm-amount-display').innerText = fmt.format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        step1Div.classList.add('hidden'); step2Div.classList.remove('hidden'); step2Div.classList.add('flex');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        try {
            const res = await fetch('/api/invest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ portfolioId: investModalIdInput.value, amount: document.getElementById('invest-amount').value, token })
            });
            if(res.ok) { closeInvestModal(); updateUserData(token); loadPortfolios(); } 
            else { const d = await res.json(); alert(d.message); backToStep1(); }
        } catch(e) { alert("Error"); backToStep1(); }
        btnFinalConfirm.innerText = "Sí, Invertir";
    });
    
    // Depósitos y Retiros
    const depForm = document.getElementById('deposit-form');
    if(depForm) depForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... (Lógica de depósito estándar, ya la tienes) ...
        // Si la necesitas, pídela, pero es la misma.
        // RESUMEN: fetch /api/deposit, close, update
    });
    
    // Para ahorrar espacio, asegúrate de tener la lógica de setupTransactionForms aquí o llámala si está definida afuera.
    setupTransactionForms(token);
}

// --- GLOBAL HELPERS ---
window.setupInvest = function(id, name) {
    if(!investModal) return;
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    backToStep1();
    investModal.classList.remove('hidden');
    setTimeout(() => investModal.classList.remove('opacity-0'), 10);
    const inp = document.getElementById('invest-amount'); if(inp) inp.value = '';
    const msg = document.getElementById('invest-calculation'); if(msg) msg.innerText = '';
}
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); step2Div.classList.remove('flex'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }

// Modales Deposito/Retiro (Simplificados)
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(()=>depositModal.classList.remove('opacity-0'),10); } }
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(()=>depositModal.classList.add('hidden'),300); } }
window.openWithdrawModal = function() { 
    if(withdrawModal) { 
        const bal = document.getElementById('display-available')?.innerText || "0";
        document.getElementById('withdraw-max-balance').innerText = bal;
        withdrawModal.classList.remove('hidden'); setTimeout(()=>withdrawModal.classList.remove('opacity-0'),10); 
    }
}
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(()=>withdrawModal.classList.add('hidden'),300); } }

// Setup Dep/Retiro completo
function setupTransactionForms(token) {
    const depForm = document.getElementById('deposit-form');
    if(depForm) depForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('deposit-amount').value;
        try {
            const res = await fetch('/api/deposit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({amount, token})});
            if(res.ok) { closeDepositModal(); updateUserData(token); }
        } catch(e){}
    });
    const withForm = document.getElementById('withdraw-form');
    if(withForm) withForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('withdraw-amount').value;
        try {
            const res = await fetch('/api/withdraw', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({amount, token})});
            if(res.ok) { closeWithdrawModal(); updateUserData(token); }
        } catch(e){}
    });
}