// public/js/portfolios.js

// --- VARIABLES GLOBALES ---
let modal, modalTitle, modalIdInput;
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. SEGURIDAD
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // 2. REFERENCIAS DOM
    modal = document.getElementById('invest-modal');
    modalTitle = document.getElementById('modal-portfolio-name');
    modalIdInput = document.getElementById('modal-portfolio-id');
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // 3. CALCULADORA
    const investInput = document.getElementById('invest-amount');
    let calcMsg = document.getElementById('invest-calculation');
    if (!calcMsg && investInput) {
        calcMsg = document.createElement('p');
        calcMsg.id = 'invest-calculation';
        calcMsg.className = 'text-xs font-bold text-primary text-right mt-1';
        investInput.parentNode.parentNode.appendChild(calcMsg);
    }
    const btnContinue = document.getElementById('btn-continue-invest');

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

    // 4. CARGAR DATOS
    await updateUserData(token);
    loadAllPortfolios();

    // 5. LISTENERS
    setupInvestmentForm(token);
});

// --- CARGA DE DATOS ---

async function updateUserData(token) {
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const user = await response.json();
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
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

        // MOSTRAR TODOS (Sin slice)
        portfolios.forEach(portfolio => {
            // Datos
            const investors = portfolio.currentInvestors || 0;
            const target = portfolio.targetInvestors || 5000;
            const spotsLeft = Math.max(0, target - investors);
            const progress = Math.min(100, (investors / target) * 100);
            
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            const numFormat = new Intl.NumberFormat('es-MX'); 

            // Estilos
            let color = portfolio.risk === 'Alto' ? 'bg-red-100 text-red-600' : (portfolio.risk === 'Bajo' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600');
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(portfolio.id - 1) % icons.length] || '📈';

            const cardHTML = `
                <div class="flex flex-col bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:shadow-lg transition-all duration-300">
                    <div class="flex justify-between mb-3">
                        <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors">${icon}</div>
                        <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${color}">Riesgo ${portfolio.risk}</span>
                    </div>
                    <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">${portfolio.name}</h3>
                    <p class="text-xs text-slate-500 mb-4 line-clamp-2">${portfolio.description}</p>
                    
                    <div class="flex items-center gap-2 mb-4">
                        <span class="flex h-2 w-2 rounded-full ${spotsLeft>0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse"></span>
                        <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${numFormat.format(spotsLeft)} cupos disp.</span>
                    </div>

                    <div class="mt-auto">
                        <div class="flex justify-between text-xs font-bold mb-1">
                            <span class="text-slate-500">Progreso</span>
                            <span class="text-primary">${progress.toFixed(0)}%</span>
                        </div>
                        <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1">
                            <div class="bg-primary h-2 rounded-full" style="width: ${progress}%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] text-slate-400 mb-4">
                            <span>${numFormat.format(investors)} socios</span>
                            <span>Meta: ${numFormat.format(target)}</span>
                        </div>
                        <button onclick="setupInvest(${portfolio.id}, '${portfolio.name}')" 
                            class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            ${spotsLeft === 0 ? 'disabled' : ''}>
                            ${spotsLeft === 0 ? 'Grupo Lleno' : 'Unirme al Grupo'}
                        </button>
                    </div>
                </div>`;
            gridContainer.innerHTML += cardHTML;
        });
    } catch (error) { console.error(error); }
}

// --- FORMULARIOS ---

function setupInvestmentForm(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        if(!amount || amount < 1000 || amount % 1000 !== 0) return;
        
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
        document.getElementById('confirm-amount-display').innerText = fmt.format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        
        step1Div.classList.add('hidden');
        step2Div.classList.remove('hidden');
        step2Div.classList.add('flex');
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
            const d = await res.json();
            if(res.ok) {
                closeModal();
                updateUserData(token);
                loadAllPortfolios();
            } else {
                alert(d.message);
                backToStep1();
            }
        } catch(e) { alert("Error"); backToStep1(); }
        btnFinalConfirm.innerText = "Sí, Invertir";
    });
}

// --- GLOBALES ---
window.setupInvest = function(id, name) {
    if(!modal) return;
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    backToStep1();
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    const inp = document.getElementById('invest-amount'); if(inp) inp.value = '';
    const msg = document.getElementById('invest-calculation'); if(msg) { msg.innerText = "Ingresa un monto (Mín. $1,000)"; msg.className = "text-xs font-bold text-primary text-right mt-1"; }
}

window.backToStep1 = function() {
    step1Div.classList.remove('hidden');
    step2Div.classList.add('hidden');
    step2Div.classList.remove('flex');
}

window.closeModal = function() {
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}