// public/js/investments.js
let sellModal, successModal, confirmSellBtn, sellIdInput;
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    sellModal = document.getElementById('sell-modal');
    successModal = document.getElementById('success-modal');
    confirmSellBtn = document.getElementById('btn-confirm-sell');
    sellIdInput = document.getElementById('sell-investment-id');
    const tableBody = document.getElementById('investments-table-body');
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const response = await fetch('/api/my-investments', { headers: { 'Authorization': `Bearer ${token}` } });
        const investments = await response.json();

        tableBody.innerHTML = '';
        if (investments.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500">No tienes inversiones.</td></tr>';
            return;
        }

        investments.forEach(inv => {
            tableBody.innerHTML += `
                <tr class="hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-slate-700">
                    <td class="p-4 font-bold dark:text-white">${inv.portfolioName}</td>
                    <td class="p-4 text-sm text-slate-500">${new Date(inv.date).toLocaleDateString()}</td>
                    <td class="p-4 text-right font-mono">${fmt.format(inv.investedAmount)}</td>
                    <td class="p-4 text-right font-mono font-bold">${fmt.format(inv.currentValue)}</td>
                    <td class="p-4 text-right font-bold ${inv.profit>=0?'text-emerald-500':'text-red-500'}">${fmt.format(inv.profit)}</td>
                    <td class="p-4 text-center"><span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">Activo</span></td>
                    <td class="p-4 text-right"><button onclick="window.openSellModal(${inv.id})" class="text-xs border border-slate-300 dark:border-slate-600 px-3 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white">Vender</button></td>
                </tr>`;
        });
    } catch (e) { console.error(e); }

    if(confirmSellBtn) confirmSellBtn.addEventListener('click', async () => {
        confirmSellBtn.innerText = "Procesando..."; confirmSellBtn.disabled = true;
        try {
            const res = await fetch('/api/sell', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ investmentId: sellIdInput.value, token }) });
            if(res.ok) { window.closeSellModal(); window.showSuccess(); } else { alert("Error"); }
        } catch(e) { alert("Error conexión"); }
        confirmSellBtn.innerText = "Vender"; confirmSellBtn.disabled = false;
    });
});

window.openSellModal = function(id) { sellIdInput.value=id; sellModal.classList.remove('hidden'); }
window.closeSellModal = function() { sellModal.classList.add('hidden'); }
window.showSuccess = function() { successModal.classList.remove('hidden'); }
window.closeSuccessModal = function() { window.location.reload(); }