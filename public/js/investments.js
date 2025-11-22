// public/js/investments.js
let sellModal, successModal, confirmSellBtn, sellIdInput;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // REFS
    sellModal = document.getElementById('sell-modal');
    successModal = document.getElementById('success-modal');
    confirmSellBtn = document.getElementById('btn-confirm-sell');
    sellIdInput = document.getElementById('sell-investment-id');
    const tableBody = document.getElementById('investments-table-body');

    try {
        const response = await fetch('/api/my-investments', { headers: { 'Authorization': `Bearer ${token}` } });
        if(!response.ok) throw new Error("Error API");
        const investments = await response.json();
        const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

        tableBody.innerHTML = '';
        if (investments.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500">No tienes inversiones activas.</td></tr>';
            return;
        }

        investments.forEach(inv => {
            const profitClass = inv.profit >= 0 ? 'text-emerald-500' : 'text-red-500';
            const sign = inv.profit >= 0 ? '+' : '';
            
            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-4 font-bold text-slate-900 dark:text-white">${inv.portfolioName}</td>
                    <td class="p-4 text-sm text-slate-500">${new Date(inv.date).toLocaleDateString()}</td>
                    <td class="p-4 text-right font-mono text-slate-600 dark:text-slate-300">${fmt.format(inv.investedAmount)}</td>
                    <td class="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">${fmt.format(inv.currentValue)}</td>
                    <td class="p-4 text-right font-mono font-bold ${profitClass}">${sign}${fmt.format(inv.profit)}</td>
                    <td class="p-4 text-center"><span class="px-2 py-1 rounded-md text-xs bg-emerald-100 text-emerald-700 font-bold">Activo</span></td>
                    <td class="p-4 text-right">
                        <button onclick="openSellModal(${inv.id})" class="text-xs font-bold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">Vender</button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) { console.error(error); tableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-red-500">Error cargando datos.</td></tr>'; }

    if(confirmSellBtn) {
        confirmSellBtn.addEventListener('click', async () => {
            const id = sellIdInput.value;
            confirmSellBtn.innerText = "Procesando...";
            confirmSellBtn.disabled = true;
            try {
                const res = await fetch('/api/sell', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ investmentId: id, token })
                });
                if(res.ok) { closeSellModal(); showSuccess(); } 
                else { alert("Error al vender"); }
            } catch(e) { alert("Error de conexión"); }
            confirmSellBtn.innerText = "Vender"; confirmSellBtn.disabled = false;
        });
    }
});

window.openSellModal = function(id) { if(sellModal) { sellIdInput.value=id; sellModal.classList.remove('hidden'); } }
window.closeSellModal = function() { if(sellModal) sellModal.classList.add('hidden'); }
window.showSuccess = function() { if(successModal) successModal.classList.remove('hidden'); }
window.closeSuccessModal = function() { window.location.reload(); }