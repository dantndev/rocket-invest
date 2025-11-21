// public/js/dashboard.js
let investModal, depositModal, withdrawModal, successModal;
let step1Div, step2Div, btnFinalConfirm;
let investModalTitle, investModalIdInput, confirmPortfolioName, confirmAmountDisplay;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // Referencias DOM
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
    const investInput = document.getElementById('invest-amount');
    let calcMsg = document.getElementById('invest-calculation');
    if (!calcMsg && investInput) {
        calcMsg = document.createElement('p');
        calcMsg.id = 'invest-calculation';
        calcMsg.className = 'text-xs font-bold text-primary text-right mt-1';
        investInput.parentNode.parentNode.appendChild(calcMsg);
    }
    const btnContinue = document.getElementById('btn-continue-invest');
    if (investInput) investInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if (!val || val < min) { calcMsg.innerText = `Mín $${min}`; calcMsg.className = "text-xs font-bold text-red-400 text-right mt-1"; if(btnContinue) btnContinue.disabled=true; }
        else if (val % min !== 0) { calcMsg.innerText = `Múltiplos de $${min}`; calcMsg.className = "text-xs font-bold text-orange-400 text-right mt-1"; if(btnContinue) btnContinue.disabled=true; }
        else { const p = val/min; calcMsg.innerText = `Adquiriendo ${p} Ticket${p>1?'s':''}`; calcMsg.className = "text-xs font-bold text-emerald-500 text-right mt-1"; if(btnContinue) btnContinue.disabled=false; }
    });

    // Carga Datos
    await updateUserData(token);
    await loadPortfolios();
    renderMarketChart();

    const btnVer = document.getElementById('btn-ver-todos');
    if(btnVer) btnVer.addEventListener('click', () => window.location.href = 'portfolios.html');

    setupFormListeners(token);
});

// public/js/portfolios.js
// Copia TODO el contenido de dashboard.js que te acabo de dar arriba.
// Y reemplaza la función loadPortfolios por esta:

async function loadPortfolios() { // Puedes llamarla loadAllPortfolios si prefieres
    try {
        const res = await fetch('/api/portfolios?t=' + Date.now());
        const data = await res.json();
        const grid = document.getElementById('portfolio-grid');
        if(!grid) return;
        grid.innerHTML = '';

        // SIN SLICE (Muestra todos)
        data.forEach(p => {
             // ... (COPIA EL MISMO CONTENIDO DEL FOR EACH DE DASHBOARD.JS AQUÍ ADENTRO) ...
             // Es exactamente la misma lógica de renderizado de tarjeta.
             const total = p.totalTickets;
             // ... etc ...
             // Hasta el grid.innerHTML += cardHTML;
        });
    } catch(e) { console.error(e); }
}

function setupFormListeners(token) {
    const f1 = document.getElementById('investment-form-step1');
    if(f1) f1.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('invest-amount').value);
        const min = parseInt(investModal.dataset.ticket || 1000);
        if(!amount || amount < min || amount % min !== 0) return;
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
        document.getElementById('confirm-amount-display').innerText = fmt.format(amount);
        document.getElementById('confirm-portfolio-name').innerText = investModalTitle.innerText;
        step1Div.classList.add('hidden'); step2Div.classList.remove('hidden');
    });

    if(btnFinalConfirm) btnFinalConfirm.addEventListener('click', async () => {
        btnFinalConfirm.innerText = "Procesando...";
        const pid = investModalIdInput.value;
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
                window.showSuccess(); // LLAMADA SEGURA AL MODAL DE ÉXITO
            } else { 
                const d = await res.json(); 
                alert(d.message); 
                backToStep1(); 
            }
        } catch(e) { alert("Error de red"); backToStep1(); }
        btnFinalConfirm.innerText = "Confirmar";
    });

    setupTxForms(token);
}

function setupTxForms(token) {
    const d = document.getElementById('deposit-form'); if(d) d.addEventListener('submit', async(e)=>{ e.preventDefault(); const am=document.getElementById('deposit-amount').value; try{ await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount:am,token})}); closeDepositModal(); updateUserData(token); document.getElementById('deposit-amount').value=''; alert("Depósito OK"); }catch(e){} });
    const w = document.getElementById('withdraw-form'); if(w) w.addEventListener('submit', async(e)=>{ e.preventDefault(); const am=document.getElementById('withdraw-amount').value; try{ await fetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount:am,token})}); closeWithdrawModal(); updateUserData(token); document.getElementById('withdraw-amount').value=''; alert("Retiro OK"); }catch(e){} });
}
async function updateUserData(token) { try { const r=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${token}`}}); if(r.ok) updateBalanceUI(await r.json()); } catch(e){} }
function updateBalanceUI(d) { const f=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); document.getElementById('display-net-worth').innerHTML=`${f.format(d.netWorth)} <span class="text-2xl">MXN</span>`; document.getElementById('display-available').innerText=f.format(d.availableBalance); document.getElementById('display-invested').innerText=f.format(d.investedAmount); document.getElementById('modal-balance-display').innerText=f.format(d.availableBalance); document.getElementById('withdraw-max-balance').innerText=f.format(d.availableBalance); const p=document.getElementById('display-profit'); if(p){p.innerText=(d.profit>=0?'+':'')+f.format(d.profit);p.className=d.profit>=0?"text-emerald-500 font-bold text-lg":"text-red-500 font-bold text-lg";} }
function renderMarketChart() { const ctx=document.getElementById('marketChart'); if(!ctx)return; try{ fetch('/api/market').then(r=>r.json()).then(d=>{ new Chart(ctx,{type:'line',data:{labels:d.dates.map(t=>new Date(t*1000).toLocaleDateString('es-MX')),datasets:[{data:d.prices,borderColor:'#307de8',borderWidth:2,pointRadius:0,pointHitRadius:20}]},options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{display:false},y:{display:false}},plugins:{legend:{display:false}}}}); }); }catch(e){} }

// GLOBALES
window.setupInvest = function(id, name, ticket) { if(!investModal) return; investModalTitle.innerText = name; investModalIdInput.value = id; investModal.dataset.ticket = ticket; backToStep1(); investModal.classList.remove('hidden'); setTimeout(() => { investModal.classList.remove('opacity-0'); investModal.querySelector('div').classList.add('scale-100'); }, 10); const inp = document.getElementById('invest-amount'); if(inp) { inp.value = ''; inp.placeholder = `Ej. ${ticket}`; inp.step = ticket; inp.min = ticket; } const msg = document.getElementById('invest-calculation'); if(msg) msg.innerText = ''; }
window.backToStep1 = function() { step1Div.classList.remove('hidden'); step2Div.classList.add('hidden'); }
window.closeModal = function() { investModal.classList.add('opacity-0'); setTimeout(() => investModal.classList.add('hidden'), 300); }
window.showSuccess = function() { const m=document.getElementById('success-modal'); if(m){m.classList.remove('hidden');setTimeout(()=>{m.classList.remove('opacity-0');m.querySelector('div').classList.add('scale-100')},10);} }
window.closeSuccessModal = function() { const m=document.getElementById('success-modal'); if(m){m.classList.add('opacity-0');setTimeout(()=>m.classList.add('hidden'),300);} }
window.openDepositModal = function() { if(depositModal) { depositModal.classList.remove('hidden'); setTimeout(() => depositModal.classList.remove('opacity-0'),10); }};
window.closeDepositModal = function() { if(depositModal) { depositModal.classList.add('opacity-0'); setTimeout(() => depositModal.classList.add('hidden'),300); }};
window.openWithdrawModal = function() { if(withdrawModal) { const b = document.getElementById('display-available')?.innerText || "0"; document.getElementById('withdraw-max-balance').innerText = b; withdrawModal.classList.remove('hidden'); setTimeout(() => withdrawModal.classList.remove('opacity-0'),10); }};
window.closeWithdrawModal = function() { if(withdrawModal) { withdrawModal.classList.add('opacity-0'); setTimeout(() => withdrawModal.classList.add('hidden'),300); }};