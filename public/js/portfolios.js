// public/js/portfolios.js

let investModal, investModalTitle, investModalIdInput;
let depositModal, withdrawModal;
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // 1. REFERENCIAS
    investModal = document.getElementById('invest-modal');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal');

    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // --- CALCULADORA EN TIEMPO REAL (INPUT MANUAL) ---
    const investInput = document.getElementById('invest-amount');
    // Crear mensaje dinámico si no existe
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

    // --- INPUTS EXTRA (Tarjeta y Fecha) ---
    const cardInput = document.getElementById('card-number');
    if (cardInput) cardInput.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').substring(0,16).match(/.{1,4}/g)?.join(' ') || e.target.value; });
    
    const expiryInput = document.getElementById('card-expiry');
    if (expiryInput) expiryInput.addEventListener('input', (e) => { 
        let v = e.target.value.replace(/\D/g, ''); 
        if(v.length > 2) v = v.substring(0,2) + '/' + v.substring(2,4);
        e.target.value = v; 
    });

    // 2. CARGAR DATOS
    await updateUserData(token);
    loadAllPortfolios(); // SIN SLICE (Todos)

    // --- LISTENERS ---
    setupInvestmentForm(token);
    setupTransactionForms(token);
});


// --- CARGA DE DATOS ---

async function loadAllPortfolios() {
    try {
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const gridContainer = document.getElementById('portfolio-grid');
        if(!gridContainer) return;
        
        gridContainer.innerHTML = ''; 

        // RECORRER TODOS (Sin slice)
        portfolios.forEach(portfolio => {
            const investors = portfolio.currentInvestors || 0;
            const target = portfolio.targetInvestors || 5000;
            const spotsLeft = Math.max(0, target - investors);
            const progress = Math.min(100, (investors / target) * 100);
            
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            const numFormat = new Intl.NumberFormat('es-MX'); 

            let riskColorBg = portfolio.risk === 'Alto' ? 'bg-red-100 dark:bg-red-500/10' : (portfolio.risk === 'Medio' ? 'bg-orange-100 dark:bg-orange-500/10' : 'bg-green-100 dark:bg-green-500/10');
            let riskColorText = portfolio.risk === 'Alto' ? 'text-red-600 dark:text-red-400' : (portfolio.risk === 'Medio' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400');
            let riskBorder = portfolio.risk === 'Alto' ? 'border-red-200 dark:border-red-500/20' : (portfolio.risk === 'Medio' ? 'border-orange-200 dark:border-orange-500/20' : 'border-green-200 dark:border-green-500/20');
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(portfolio.id - 1) % icons.length] || '📈';

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
                            <span class="flex h-2 w-2 rounded-full ${spotsLeft>0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse"></span>
                            <span class="text-xs font-bold text-green-600 dark:text-green-400">${numFormat.format(spotsLeft)} cupos disp.</span>
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
                        
                        <button onclick="selectPortfolio(${portfolio.id}, '${portfolio.name}')" 
                            class="w-full py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            ${spotsLeft === 0 ? 'disabled' : ''}>
                            <span>${spotsLeft === 0 ? 'Fondo Cerrado' : 'Unirme al Grupo'}</span>
                            ${spotsLeft > 0 ? '<span class="material-symbols-outlined text-sm">group_add</span>' : ''}
                        </button>
                    </div>
                </div>
            `;
            gridContainer.innerHTML += cardHTML;
        });
    } catch (error) { console.error(error); }
}

async function updateUserData(token) {
    try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
            const userData = await response.json();
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
            // En Portfolios solo actualizamos el saldo del modal
            const modalBal = document.getElementById('modal-balance-display');
            if(modalBal) modalBal.innerText = formatter.format(userData.availableBalance);
            const withBal = document.getElementById('withdraw-max-balance');
            if(withBal) withBal.innerText = formatter.format(userData.availableBalance);
        }
    } catch (error) { console.error("Error cargando usuario", error); }
}

// --- HELPERS DE FORMULARIOS Y MODALES ---

function setupInvestmentForm(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        if(!amount || amount < 1000 || amount % 1000 !== 0) return;
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
        document.getElementById('confirm-amount-display').innerText = fmt.format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        step1Div.classList.add('hidden'); step2Div.classList.remove('hidden'); step2Div.classList.add('flex');
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
                closeInvestModal();
                updateUserData(token);
                loadAllPortfolios(); // Actualizar barra de progreso
            } else {
                alert(d.message);
                backToStep1();
            }
        } catch(e) { alert("Error"); backToStep1(); }
        btnFinalConfirm.innerText = "Sí, Invertir";
    });
}

function setupTransactionForms(token) {
    const dep = document.getElementById('deposit-form'); if(dep) dep.addEventListener('submit', async(e)=>{ e.preventDefault(); const amount=document.getElementById('deposit-amount').value; const btn=document.getElementById('btn-confirm-deposit'); const orig=btn.innerText; btn.disabled=true; btn.innerText="Procesando..."; try{ const r=await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount,token})}); if(r.ok){closeDepositModal(); updateUserData(token); document.getElementById('deposit-amount').value='';} }catch(e){} finally{btn.disabled=false;btn.innerText=orig;} });
    const wit = document.getElementById('withdraw-form'); if(wit) wit.addEventListener('submit', async(e)=>{ e.preventDefault(); const amount=document.getElementById('withdraw-amount').value; const btn=document.getElementById('btn-confirm-withdraw'); const orig=btn.innerText; btn.disabled=true; btn.innerText="Enviando..."; try{ const r=await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount,token})}); if(r.ok){closeWithdrawModal(); updateUserData(token); document.getElementById('withdraw-amount').value='';} }catch(e){} finally{btn.disabled=false;btn.innerText=orig;} });
}

window.setupInvest = function(id, name) {
    if(!investModal) return;
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    backToStep1();
    investModal.classList.remove('hidden'); setTimeout(() => investModal.classList.remove('opacity-0'), 10);
    const inp = document.getElementById('invest-amount'); if(inp) inp.value = '';
    const msg = document.getElementById('invest-calculation'); if(msg) { msg.innerText = "Ingresa un monto (Mín. $1,000)"; msg.className = "text-xs font-bold text-primary text-right mt-1"; }
}
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); step2Div.classList.remove('flex'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { const b = document.getElementById('modal-balance-display')?.innerText || "0"; document.getElementById('withdraw-max-balance').innerText = b; withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};