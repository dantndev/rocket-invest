// public/js/dashboard.js
let investModal, step1Div, step2Div, btnFinalConfirm;
let depositModal, withdrawModal;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Referencias
    investModal = document.getElementById('invest-modal');
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    btnFinalConfirm = document.getElementById('btn-final-confirm');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');

    // Cargar Datos (Orden importante)
    await updateUserData(token); // Saldo
    loadPortfolios();            // Tarjetas
    renderMarketChart();         // Gráfica

    // Listener Ver Todos
    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');

    // LISTENERS DE FORMULARIOS
    setupForms(token);
});

// --- CARGA DE DATOS ---

async function updateUserData(token) {
    try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` }});
        if(res.ok) {
            const data = await res.json();
            const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
            
            setText('display-net-worth', fmt.format(data.netWorth));
            setText('display-available', fmt.format(data.availableBalance));
            setText('display-invested', fmt.format(data.investedAmount));
            
            const elProf = document.getElementById('display-profit');
            if(elProf) {
                elProf.innerText = (data.profit >= 0 ? '+' : '') + fmt.format(data.profit);
                elProf.className = data.profit >= 0 ? "text-emerald-500 font-bold text-lg" : "text-red-500 font-bold text-lg";
            }
            setText('modal-balance-display', fmt.format(data.availableBalance));
            setText('withdraw-max-balance', fmt.format(data.availableBalance));
        }
    } catch(e) { console.error(e); }
}

async function loadPortfolios() {
    try {
        const res = await fetch('/api/portfolios');
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        // SOLO LOS PRIMEROS 3
        data.slice(0, 3).forEach(p => {
            const progress = Math.min(100, (p.currentInvestors / p.targetInvestors) * 100);
            const fmt = new Intl.NumberFormat('es-MX');
            
            // Lógica de colores
            let colorClass = p.risk === 'Alto' ? 'text-red-500 bg-red-50' : (p.risk === 'Bajo' ? 'text-green-500 bg-green-50' : 'text-orange-500 bg-orange-50');
            
            const html = `
            <div class="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full">
                <div class="flex justify-between mb-3">
                    <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">🚀</div>
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${colorClass}">${p.risk}</span>
                </div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white">${p.name}</h3>
                <p class="text-xs text-slate-500 mb-4">${p.description}</p>
                
                <div class="mt-auto">
                    <div class="flex justify-between text-xs font-bold mb-1">
                        <span class="text-slate-500">Progreso</span>
                        <span class="text-primary">${progress.toFixed(0)}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-4">
                        <div class="bg-primary h-2 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <button onclick="setupInvest(${p.id}, '${p.name}')" class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm">Unirme</button>
                </div>
            </div>`;
            grid.innerHTML += html;
        });
    } catch(e) { console.error(e); }
}

function renderMarketChart() {
    const ctx = document.getElementById('marketChart');
    if(!ctx) return;
    // (Aquí va tu código de Chart.js que ya tenías funcionando)
    // Si lo necesitas de nuevo, dime, pero para ahorrar espacio asumo que lo tienes.
}

// --- FORMULARIOS ---
function setupForms(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('invest-amount').value;
        if(!amount) return alert("Elige monto");
        
        // Mostrar Paso 2
        step1Div.classList.add('hidden');
        step2Div.classList.remove('hidden');
        document.getElementById('confirm-amount-display').innerText = `$${amount}`;
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
                closeModal();
                updateUserData(token);
                loadPortfolios();
            } else {
                const err = await res.json();
                alert(err.message);
                backToStep1();
            }
        } catch(e) { alert("Error de red"); }
        btnFinalConfirm.innerText = "Sí, Invertir";
    });
    
    // (Agrega aquí listeners de deposito/retiro similares)
}

// --- HELPERS GLOBALES ---
window.setupInvest = function(id, name) {
    if(!investModal) return;
    document.getElementById('modal-portfolio-name').innerText = name;
    document.getElementById('confirm-portfolio-name').innerText = name;
    document.getElementById('modal-portfolio-id').value = id;
    
    backToStep1(); // Reset
    investModal.classList.remove('hidden');
    setTimeout(() => investModal.classList.remove('opacity-0'), 10);
}

window.backToStep1 = function() {
    step1Div.classList.remove('hidden');
    step2Div.classList.add('hidden');
}

window.closeModal = function() {
    investModal.classList.add('opacity-0');
    setTimeout(() => investModal.classList.add('hidden'), 300);
}
window.openDepositModal = function() { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }
window.closeDepositModal = function() { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }
window.openWithdrawModal = function() { withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }
window.closeWithdrawModal = function() { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }

function setText(id, val) { const el = document.getElementById(id); if(el) el.innerHTML = val; }