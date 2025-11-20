// public/js/portfolios.js

// --- VARIABLES GLOBALES ---
let investModal, investModalTitle, investModalIdInput;
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. SEGURIDAD: Verificar sesión
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // 2. INICIALIZAR REFERENCIAS DEL DOM
    investModal = document.getElementById('invest-modal');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // 3. INICIALIZAR CALCULADORA EN TIEMPO REAL
    initInvestmentCalculator();

    // 4. CARGAR DATOS
    await updateUserData(token);
    loadAllPortfolios(); // Carga TODOS los portafolios sin límite

    // 5. CONFIGURAR FORMULARIO DE INVERSIÓN
    setupInvestmentForm(token);
});

// --- FUNCIONES DE INICIALIZACIÓN ---

function initInvestmentCalculator() {
    const investInput = document.getElementById('invest-amount');
    
    // Crear el elemento de mensaje si no existe en el HTML
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
}

// --- CARGA DE DATOS ---

async function updateUserData(token) {
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const user = await response.json();
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            
            // Actualizar saldo en el modal si está abierto
            const balanceSpan = document.getElementById('modal-balance-display');
            if(balanceSpan) balanceSpan.innerText = formatter.format(user.availableBalance);
        }
    } catch (error) { console.error("Error cargando usuario", error); }
}

async function loadAllPortfolios() {
    try {
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const gridContainer = document.getElementById('portfolio-grid');
        
        if(!gridContainer) return;
        gridContainer.innerHTML = ''; 

        // Renderizar TODOS los portafolios (Sin .slice)
        portfolios.forEach(portfolio => {
            
            // --- LÓGICA DE DISEÑO CROWDFUNDING ---
            const investors = portfolio.currentInvestors || 0;
            const target = portfolio.targetInvestors || 5000;
            const spotsLeft = Math.max(0, target - investors);
            const progress = Math.min(100, (investors / target) * 100);
            
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            const numFormat = new Intl.NumberFormat('es-MX'); 

            // Colores dinámicos según riesgo
            let riskColorBg = portfolio.risk === 'Alto' ? 'bg-red-100 dark:bg-red-500/10' : (portfolio.risk === 'Medio' ? 'bg-orange-100 dark:bg-orange-500/10' : 'bg-green-100 dark:bg-green-500/10');
            let riskColorText = portfolio.risk === 'Alto' ? 'text-red-600 dark:text-red-400' : (portfolio.risk === 'Medio' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400');
            let riskBorder = portfolio.risk === 'Alto' ? 'border-red-200 dark:border-red-500/20' : (portfolio.risk === 'Medio' ? 'border-orange-200 dark:border-orange-500/20' : 'border-green-200 dark:border-green-500/20');
            
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(portfolio.id - 1) % icons.length] || '📈';

            const cardHTML = `
                <div class="flex flex-col bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300 group h-full overflow-hidden">
                    
                    <div class="p-6 pb-4">
                        <div class="flex justify-between items-start mb-3">
                            <div class="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors">${icon}</div>
                            <div class="flex flex-col items-end">
                                <span class="px-2 py-1 text-[10px] uppercase font-bold rounded-full ${riskColorBg} ${riskColorText} border ${riskBorder} mb-1">Riesgo ${portfolio.risk}</span>
                                <span class="text-[10px] text-slate-400 font-medium">Lock-up: ${portfolio.lockUpPeriod}</span>
                            </div>
                        </div>
                        <h3 class="text-slate-900 dark:text-white text-lg font-bold mb-1 leading-tight">${portfolio.name}</h3>
                        <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mb-4">${portfolio.provider}</p>
                        
                        <div class="flex items-center gap-2 mb-2">
                            <span class="flex h-2 w-2 rounded-full ${spotsLeft > 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse"></span>
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${numFormat.format(spotsLeft)} cupos disp.</span>
                        </div>
                    </div>

                    <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-b border-slate-100 dark:border-slate-700">
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-700 dark:text-white">Progreso del Grupo</span>
                            <span class="text-primary">${progress.toFixed(0)}%</span>
                        </div>
                        <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-2">
                            <div class="bg-primary h-2.5 rounded-full transition-all duration-1000" style="width: ${progress}%"></div>
                        </div>
                        <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">person</span>
                                ${numFormat.format(investors)} inscritos
                            </span>
                            <span>Meta: ${numFormat.format(target)}</span>
                        </div>
                    </div>

                    <div class="p-6 pt-4 mt-auto">
                        <div class="flex items-center justify-between mb-4">
                             <div class="flex flex-col">
                                <span class="text-xs text-slate-400">Rend. Histórico</span>
                                <span class="text-lg font-bold text-green-500">+${portfolio.returnYTD}%</span>
                             </div>
                             <div class="flex flex-col text-right">
                                <span class="text-xs text-slate-400">Ticket Mínimo</span>
                                <span class="text-sm font-bold text-slate-900 dark:text-white">${formatter.format(portfolio.minInvestment)}</span>
                             </div>
                        </div>
                        
                        <button onclick="setupInvest(${portfolio.id}, '${portfolio.name}')" class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" ${spotsLeft === 0 ? 'disabled' : ''}>
                            ${spotsLeft === 0 ? 'Grupo Lleno' : 'Unirme al Grupo'}
                        </button>
                    </div>
                </div>
            `;
            gridContainer.innerHTML += cardHTML;
        });
    } catch (error) { 
        console.error(error);
        const grid = document.getElementById('portfolio-grid');
        if(grid) grid.innerHTML = '<p class="col-span-3 text-center text-red-500 py-10">Error cargando portafolios. Intenta recargar.</p>';
    }
}

// --- LÓGICA DEL FORMULARIO DE INVERSIÓN (2 PASOS) ---

function setupInvestmentForm(token) {
    // Paso 1: Validar y mostrar resumen
    const formStep1 = document.getElementById('investment-form-step1');
    if (formStep1) {
        formStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const amountInput = document.getElementById('invest-amount');
            const amount = parseInt(amountInput.value);
            const portfolioName = investModalTitle.innerText;

            // Validación
            if (!amount || amount < 1000 || amount % 1000 !== 0) {
                // El mensaje ya lo muestra la calculadora, pero por seguridad:
                return; 
            }

            // Llenar datos del resumen (Paso 2)
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            if(confirmAmountDisplay) confirmAmountDisplay.innerText = formatter.format(amount);
            if(confirmPortfolioName) confirmPortfolioName.innerText = portfolioName;

            // Cambiar al Paso 2
            if(step1Div && step2Div) {
                step1Div.classList.add('hidden');
                step2Div.classList.remove('hidden');
                step2Div.classList.add('flex');
            }
        });
    }

    // Paso 2: Enviar datos al servidor
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
                    loadAllPortfolios(); // Recargar para ver el contador subir
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
}

// --- FUNCIONES GLOBALES (Accesibles desde el HTML) ---

window.setupInvest = function(id, name) {
    if (!investModal) return;
    
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    
    // Resetear al estado inicial (Paso 1)
    backToStep1();
    
    // Limpiar campos
    const input = document.getElementById('invest-amount');
    if(input) input.value = '';
    const msg = document.getElementById('invest-calculation');
    if(msg) {
        msg.innerText = "Ingresa un monto (Mín. $1,000)";
        msg.className = "text-xs font-bold text-primary text-right mt-1";
    }

    // Mostrar Modal
    investModal.classList.remove('hidden');
    setTimeout(() => {
        investModal.classList.remove('opacity-0');
        investModal.querySelector('div').classList.remove('scale-95');
        investModal.querySelector('div').classList.add('scale-100');
    }, 10);
};

window.backToStep1 = function() {
    if(step1Div && step2Div) {
        step2Div.classList.add('hidden');
        step2Div.classList.remove('flex');
        step1Div.classList.remove('hidden');
    }
};

window.closeModal = function() {
    if (!investModal) return;
    investModal.classList.add('opacity-0');
    investModal.querySelector('div').classList.remove('scale-100');
    investModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { investModal.classList.add('hidden'); }, 300);
};