// public/js/portfolios.js

// --- VARIABLES GLOBALES ---
let modal, modalTitle, modalIdInput;
// Variables para el Modal de 2 Pasos
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. REFERENCIAS DEL DOM
    modal = document.getElementById('invest-modal');
    modalTitle = document.getElementById('modal-portfolio-name');
    modalIdInput = document.getElementById('modal-portfolio-id');
    
    // Referencias de pasos del modal
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // --- CALCULADORA EN TIEMPO REAL (NUEVO) ---
    const investInput = document.getElementById('invest-amount');
    // Creamos el elemento de mensaje dinámicamente si no existe en el HTML base
    let calcMsg = document.getElementById('invest-calculation');
    if (!calcMsg && investInput) {
        calcMsg = document.createElement('p');
        calcMsg.id = 'invest-calculation';
        calcMsg.className = 'text-xs font-bold text-primary text-right mt-1';
        investInput.parentNode.parentNode.appendChild(calcMsg);
    }
    const btnContinue = document.querySelector('#investment-form-step1 button[type="submit"]');

    if (investInput && calcMsg) {
        investInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            
            if (!val || val < 1000) {
                calcMsg.innerText = "Mínimo $1,000 MXN";
                calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1";
                if(btnContinue) btnContinue.disabled = true;
            } else if (val % 1000 !== 0) {
                calcMsg.innerText = "Solo múltiplos de $1,000";
                calcMsg.className = "text-xs font-bold text-orange-400 text-right mt-1";
                if(btnContinue) btnContinue.disabled = true;
            } else {
                const parts = val / 1000;
                calcMsg.innerText = `Adquiriendo ${parts} Participación${parts > 1 ? 'es' : ''}`;
                calcMsg.className = "text-xs font-bold text-emerald-500 text-right mt-1";
                if(btnContinue) btnContinue.disabled = false;
            }
        });
    }

    // --- SEGURIDAD ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // 2. CARGAR DATOS
    await updateUserData(token);
    loadAllPortfolios();

    // --- LISTENERS FORMULARIOS ---

    // A) Paso 1: Click en "Continuar"
    const formStep1 = document.getElementById('investment-form-step1');
    if (formStep1) {
        formStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const amount = parseInt(document.getElementById('invest-amount').value);
            const portfolioName = modalTitle.innerText;

            // Validación estricta
            if (!amount || amount < 1000 || amount % 1000 !== 0) {
                alert("El monto debe ser múltiplo de $1,000");
                return;
            }

            // Llenar datos del resumen
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            if(confirmAmountDisplay) confirmAmountDisplay.innerText = formatter.format(amount);
            if(confirmPortfolioName) confirmPortfolioName.innerText = portfolioName;

            // Cambiar pantalla
            if(step1Div && step2Div) {
                step1Div.classList.add('hidden');
                step2Div.classList.remove('hidden');
                step2Div.classList.add('flex');
            }
        });
    }

    // B) Paso 2: Click en "Sí, Invertir"
    if (btnFinalConfirm) {
        btnFinalConfirm.addEventListener('click', async () => {
            const amount = document.getElementById('invest-amount').value;
            const portfolioId = modalIdInput.value;
            
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
                    closeModal();
                    updateUserData(token);
                    loadAllPortfolios(); // Recargar para ver crecer la barra
                } else {
                    alert('Error: ' + data.message);
                    backToStep1();
                }
            } catch (error) { 
                console.error(error); 
                alert('Error de conexión');
                backToStep1();
            } finally {
                btnFinalConfirm.disabled = false;
                btnFinalConfirm.innerText = "Sí, Invertir";
            }
        });
    }
});

// --- FUNCIONES GLOBALES ---

window.backToStep1 = function() {
    if(step1Div && step2Div) {
        step2Div.classList.add('hidden');
        step2Div.classList.remove('flex');
        step1Div.classList.remove('hidden');
    }
};

window.selectPortfolio = function(id, name) {
    if (!modal) return;
    
    // Resetear al paso 1 y limpiar input
    if(step1Div && step2Div) {
        step1Div.classList.remove('hidden');
        step2Div.classList.add('hidden');
        step2Div.classList.remove('flex');
        
        const input = document.getElementById('invest-amount');
        if(input) input.value = '';
        
        const calc = document.getElementById('invest-calculation');
        if(calc) calc.innerText = '';
    }

    modalTitle.innerText = name;
    modalIdInput.value = id;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
};

window.closeModal = function() {
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
};

// --- CARGA DE DATOS ---

async function updateUserData(token) {
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const user = await response.json();
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
            const balanceSpan = document.getElementById('modal-balance-display');
            if(balanceSpan) balanceSpan.innerText = formatter.format(user.availableBalance);
        }
    } catch (error) { console.error("Error cargando usuario", error); }
}

// Esta función va en dashboard.js (slice 3) y portfolios.js (sin slice)

async function loadPortfolios() { // O loadAllPortfolios en portfolios.js
    try {
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const gridContainer = document.getElementById('portfolio-grid');
        
        if(!gridContainer) return;
        gridContainer.innerHTML = ''; 

        // Nota: Si es dashboard.js usa .slice(0,3), si es portfolios.js quítalo.
        portfolios.forEach(portfolio => { // Agrega .slice(0,3) aquí si es dashboard
            
            // --- MATEMÁTICAS DE CUPOS (LA LÓGICA NUEVA) ---
            
            const ticketPrice = portfolio.minInvestment; // $1,000
            
            // 1. Cupos Totales del Fondo = Meta Dinero / Precio Ticket
            const totalSlots = Math.floor(portfolio.targetAmount / ticketPrice);
            
            // 2. Cupos Ocupados = Dinero Recaudado / Precio Ticket
            const occupiedSlots = Math.floor(portfolio.currentAmount / ticketPrice);
            
            // 3. Cupos Restantes (Lo que mostramos)
            const remainingSlots = Math.max(0, totalSlots - occupiedSlots);
            
            // 4. Porcentaje de Llenado (Basado en dinero/cupos)
            const progress = Math.min(100, (portfolio.currentAmount / portfolio.targetAmount) * 100);
            
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            const numFormat = new Intl.NumberFormat('es-MX'); 

            // Colores
            let riskColorBg = portfolio.risk === 'Alto' ? 'bg-red-100 dark:bg-red-500/10' : (portfolio.risk === 'Medio' ? 'bg-orange-100 dark:bg-orange-500/10' : 'bg-green-100 dark:bg-green-500/10');
            let riskColorText = portfolio.risk === 'Alto' ? 'text-red-600 dark:text-red-400' : (portfolio.risk === 'Medio' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400');
            let riskBorder = portfolio.risk === 'Alto' ? 'border-red-200 dark:border-red-500/20' : (portfolio.risk === 'Medio' ? 'border-orange-200 dark:border-orange-500/20' : 'border-green-200 dark:border-green-500/20');
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(portfolio.id - 1) % icons.length];

            const cardHTML = `
                <div class="flex flex-col bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300 group h-full overflow-hidden">
                    
                    <div class="p-6 pb-4">
                        <div class="flex justify-between items-start mb-3">
                            <div class="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors">${icon}</div>
                            <div class="flex flex-col items-end">
                                <span class="px-2 py-1 text-[10px] uppercase font-bold rounded-full ${riskColorBg} ${riskColorText} border ${riskBorder} mb-1">Riesgo ${portfolio.risk}</span>
                                <span class="text-[10px] text-slate-400 font-medium">Lock-up: ${portfolio.lockUpPeriod}</span>
                            </div>
                        </div>
                        <h3 class="text-slate-900 dark:text-white text-lg font-bold mb-1 leading-tight">${portfolio.name}</h3>
                        <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mb-4">${portfolio.provider}</p>
                        
                        <div class="flex items-center gap-2 mb-2">
                            <span class="flex h-2 w-2 rounded-full ${remainingSlots < 100 ? 'bg-red-500' : 'bg-green-500'} animate-pulse"></span>
                            <span class="text-xs font-bold ${remainingSlots < 100 ? 'text-red-600' : 'text-green-600 dark:text-green-400'}">
                                ${remainingSlots === 0 ? 'AGOTADO' : `Solo ${numFormat.format(remainingSlots)} cupos disponibles`}
                            </span>
                        </div>
                    </div>

                    <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-b border-slate-100 dark:border-slate-700">
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-700 dark:text-white">Progreso de Meta</span>
                            <span class="text-primary">${progress.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-2">
                            <div class="bg-primary h-2.5 rounded-full transition-all duration-1000" style="width: ${progress}%"></div>
                        </div>
                        <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <span>${formatter.format(portfolio.currentAmount)}</span>
                            <span>Meta: ${formatter.format(portfolio.targetAmount)}</span>
                        </div>
                    </div>

                    <div class="p-6 pt-4 mt-auto">
                        <div class="flex items-center justify-between mb-4">
                             <div class="flex flex-col">
                                <span class="text-xs text-slate-400">Socios Activos</span>
                                <span class="text-sm font-bold text-slate-900 dark:text-white">${numFormat.format(portfolio.investors)}</span>
                             </div>
                             <div class="flex flex-col text-right">
                                <span class="text-xs text-slate-400">Participación</span>
                                <span class="text-sm font-bold text-slate-900 dark:text-white">$1,000.00</span>
                             </div>
                        </div>
                        
                        <button onclick="selectPortfolio(${portfolio.id}, '${portfolio.name}')" 
                            class="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            ${remainingSlots === 0 ? 'disabled' : ''}>
                            <span>${remainingSlots === 0 ? 'Fondo Cerrado' : 'Unirme al Grupo'}</span>
                            ${remainingSlots > 0 ? '<span class="material-symbols-outlined text-sm">group_add</span>' : ''}
                        </button>
                    </div>
                </div>
            `;
            gridContainer.innerHTML += cardHTML;
        });
    } catch (error) { console.error(error); }
}