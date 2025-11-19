// public/js/dashboard.js

let investModal, investModalTitle, investModalIdInput;
let depositModal, withdrawModal; 
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    // REFERENCIAS DOM
    investModal = document.getElementById('invest-modal');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');

    // Referencias Pasos
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // --- LÓGICA DE CALCULADORA DE INVERSIÓN (NUEVO) ---
    const investInput = document.getElementById('invest-amount');
    const calcMsg = document.getElementById('invest-calculation');
    const btnContinue = document.getElementById('btn-continue-invest');

    if (investInput && calcMsg) {
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            
            if (!val || val < 1000) {
                calcMsg.innerText = "Mínimo $1,000 MXN";
                calcMsg.className = "text-xs font-bold text-red-400 text-right";
                btnContinue.disabled = true;
            } else if (val % 1000 !== 0) {
                calcMsg.innerText = "Solo múltiplos de $1,000";
                calcMsg.className = "text-xs font-bold text-orange-400 text-right";
                btnContinue.disabled = true;
            } else {
                const parts = val / 1000;
                calcMsg.innerText = `Adquiriendo ${parts} Participaciones`;
                calcMsg.className = "text-xs font-bold text-emerald-500 text-right";
                btnContinue.disabled = false;
            }
        });
    }

    // Seguridad
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Carga de Datos
    await updateUserData(token);
    loadPortfolios();
    renderMarketChart();

    // --- LISTENERS ---

    // A) Inversión (Paso 1)
    const formStep1 = document.getElementById('investment-form-step1');
    if (formStep1) {
        formStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseInt(document.getElementById('invest-amount').value);
            const portfolioName = investModalTitle.innerText;

            // Doble validación
            if (!amount || amount < 1000 || amount % 1000 !== 0) {
                alert("El monto debe ser múltiplo de $1,000");
                return;
            }

            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            if(confirmAmountDisplay) confirmAmountDisplay.innerText = formatter.format(amount);
            if(confirmPortfolioName) confirmPortfolioName.innerText = portfolioName;

            if(step1Div && step2Div) {
                step1Div.classList.add('hidden');
                step2Div.classList.remove('hidden');
                step2Div.classList.add('flex');
            }
        });
    }

    // Inversión (Paso 2 - Confirmar)
    if (btnFinalConfirm) {
        btnFinalConfirm.addEventListener('click', async () => {
            const amount = document.getElementById('invest-amount').value;
            const portfolioId = investModalIdInput.value;
            
            btnFinalConfirm.disabled = true;
            btnFinalConfirm.innerText = "Procesando...";

            try {
                const response = await fetch('/api/invest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ portfolioId, amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    closeInvestModal();
                    updateUserData(token); 
                    loadPortfolios(); 
                } else {
                    alert('Error: ' + data.message);
                    backToStep1();
                }
            } catch (error) { console.error(error); alert('Error de conexión'); backToStep1(); } 
            finally {
                btnFinalConfirm.disabled = false;
                btnFinalConfirm.innerText = "Sí, Invertir";
            }
        });
    }

    // Depósito y Retiro (Mantener igual que antes)
    setupTransactionForms(token); // (Función auxiliar abajo para no repetir código largo)
});


// --- FUNCIONES DE CARGA Y UI ---

async function updateUserData(token) {
    try {
        const response = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
            const userData = await response.json();
            updateBalanceUI(userData);
        }
    } catch (e) { console.error(e); }
}

function updateBalanceUI(data) {
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    
    const ids = {
        net: document.getElementById('display-net-worth'),
        av: document.getElementById('display-available'),
        inv: document.getElementById('display-invested'),
        prof: document.getElementById('display-profit'),
        mod: document.getElementById('modal-balance-display')
    };

    if(ids.net) ids.net.innerHTML = `${formatter.format(data.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`;
    if(ids.av) ids.av.innerText = formatter.format(data.availableBalance);
    if(ids.inv) ids.inv.innerText = formatter.format(data.investedAmount);
    if(ids.mod) ids.mod.innerText = formatter.format(data.availableBalance);
    
    if(ids.prof) {
        const sign = data.profit >= 0 ? '+' : '';
        ids.prof.innerText = `${sign}${formatter.format(data.profit)}`;
        ids.prof.className = data.profit < 0 ? "text-red-500 font-bold text-lg" : "text-emerald-600 dark:text-emerald-400 font-bold text-lg";
    }
}

async function loadPortfolios() {
    try {
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        // Slice 0,3 para Dashboard (Quitar slice en portfolios.js)
        portfolios.slice(0, 3).forEach(portfolio => {
            renderPortfolioCard(portfolio, grid);
        });
    } catch (e) { console.error(e); }
}

function renderPortfolioCard(portfolio, container) {
    const numFormat = new Intl.NumberFormat('es-MX');
    
    // CORRECCIÓN DEL NaN: Usamos 'currentInvestors' que sí existe en el backend
    const investorsCount = portfolio.currentInvestors || 0; 
    const targetCount = portfolio.targetInvestors || 1000;
    
    const progress = Math.min(100, (investorsCount / targetCount) * 100);
    
    // Colores riesgo
    const colors = portfolio.risk === 'Alto' 
        ? { bg: 'bg-red-100 dark:bg-red-500/10', txt: 'text-red-600 dark:text-red-400', b: 'border-red-200 dark:border-red-500/20' }
        : (portfolio.risk === 'Medio' 
            ? { bg: 'bg-orange-100 dark:bg-orange-500/10', txt: 'text-orange-600 dark:text-orange-400', b: 'border-orange-200 dark:border-orange-500/20' }
            : { bg: 'bg-green-100 dark:bg-green-500/10', txt: 'text-green-600 dark:text-green-400', b: 'border-green-200 dark:border-green-500/20' });

    const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
    const icon = icons[(portfolio.id - 1) % icons.length];

    const html = `
        <div class="flex flex-col bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300 group h-full overflow-hidden">
            <div class="p-6 pb-4">
                <div class="flex justify-between items-start mb-3">
                    <div class="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors">${icon}</div>
                    <div class="flex flex-col items-end">
                        <span class="px-2 py-1 text-[10px] uppercase font-bold rounded-full ${colors.bg} ${colors.txt} border ${colors.b} mb-1">Riesgo ${portfolio.risk}</span>
                        <span class="text-[10px] text-slate-400 font-medium">Lock-up: ${portfolio.lockUpPeriod}</span>
                    </div>
                </div>
                <h3 class="text-slate-900 dark:text-white text-lg font-bold mb-1 leading-tight">${portfolio.name}</h3>
                <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mb-4">${portfolio.provider}</p>
                
                <div class="flex items-center gap-2 mb-2">
                    <span class="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span class="text-xs font-bold text-green-600 dark:text-green-400">Abierto a nuevos socios</span>
                </div>
            </div>

            <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-b border-slate-100 dark:border-slate-700">
                <div class="flex justify-between text-xs font-bold mb-1">
                    <span class="text-slate-700 dark:text-white">Progreso del Grupo</span>
                    <span class="text-primary">${progress.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-2">
                    <div class="bg-primary h-2.5 rounded-full transition-all duration-1000" style="width: ${progress}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">person</span>
                        ${numFormat.format(investorsCount)} inscritos
                    </span>
                    <span>Meta: ${numFormat.format(targetCount)}</span>
                </div>
            </div>

            <div class="p-6 pt-4 mt-auto">
                <div class="flex items-center justify-between mb-4">
                        <div class="flex flex-col">
                        <span class="text-xs text-slate-400">Rend. Histórico</span>
                        <span class="text-lg font-bold text-green-500">+${portfolio.returnYTD}%</span>
                        </div>
                        <div class="flex flex-col text-right">
                        <span class="text-xs text-slate-400">Ticket</span>
                        <span class="text-sm font-bold text-slate-900 dark:text-white">$1,000.00</span>
                        </div>
                </div>
                <button onclick="selectPortfolio(${portfolio.id}, '${portfolio.name}')" class="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none flex items-center justify-center gap-2">
                    <span>Unirme al Grupo</span>
                    <span class="material-symbols-outlined text-sm">group_add</span>
                </button>
            </div>
        </div>
    `;
    container.innerHTML += cardHTML;
}

function renderMarketChart() { /* (Mismo código de gráfica de siempre) */ }

// Setup Deposito/Retiro Forms (Para limpiar el main)
function setupTransactionForms(token) {
    // (Aquí pones los listeners de depósito y retiro que ya tenías para no repetir)
    // Por brevedad no los pego de nuevo, pero asegúrate de que estén en el DOMContentLoaded
}

// GLOBALES (Modales)
window.backToStep1 = function() {
    if(step1Div) { step2Div.classList.add('hidden'); step2Div.classList.remove('flex'); step1Div.classList.remove('hidden'); }
};
window.selectPortfolio = function(id, name) {
    if (!investModal) return;
    if(step1Div) {
        step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); step2Div.classList.remove('flex');
        document.getElementById('invest-amount').value = '';
        // Limpiar mensaje calculo
        const calc = document.getElementById('invest-calculation');
        if(calc) { calc.innerText = "Ingresa un monto (Mín. $1,000)"; calc.className = "text-xs font-bold text-primary text-right"; }
    }
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.classList.remove('hidden');
    setTimeout(() => { investModal.classList.remove('opacity-0'); investModal.querySelector('div').classList.remove('scale-95'); investModal.querySelector('div').classList.add('scale-100'); }, 10);
};
window.closeModal = function() { closeInvestModal(); };
function closeInvestModal() {
    if (!investModal) return;
    investModal.classList.add('opacity-0');
    investModal.querySelector('div').classList.remove('scale-100');
    investModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { investModal.classList.add('hidden'); }, 300);
}
// ... (Funciones open/close Deposit y Withdraw igual que antes) ...
window.openDepositModal = function() {
    if (!depositModal) depositModal = document.getElementById('deposit-modal');
    if (!depositModal) return;
    depositModal.classList.remove('hidden');
    setTimeout(() => { depositModal.classList.remove('opacity-0'); depositModal.querySelector('div').classList.remove('scale-95'); depositModal.querySelector('div').classList.add('scale-100'); }, 10);
};
window.closeDepositModal = function() {
    if (!depositModal) return;
    depositModal.classList.add('opacity-0');
    depositModal.querySelector('div').classList.remove('scale-100');
    depositModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { depositModal.classList.add('hidden'); }, 300);
};
window.openWithdrawModal = function() {
    if (!withdrawModal) withdrawModal = document.getElementById('withdraw-modal');
    if (!withdrawModal) return;
    const bal = document.getElementById('display-available')?.innerText || "0";
    const mb = document.getElementById('withdraw-max-balance');
    if(mb) mb.innerText = bal;
    withdrawModal.classList.remove('hidden');
    setTimeout(() => { withdrawModal.classList.remove('opacity-0'); withdrawModal.querySelector('div').classList.remove('scale-95'); withdrawModal.querySelector('div').classList.add('scale-100'); }, 10);
};
window.closeWithdrawModal = function() {
    if (!withdrawModal) return;
    withdrawModal.classList.add('opacity-0');
    withdrawModal.querySelector('div').classList.remove('scale-100');
    withdrawModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { withdrawModal.classList.add('hidden'); }, 300);
};