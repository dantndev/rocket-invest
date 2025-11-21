// public/js/investments.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const tableBody = document.getElementById('investments-table-body');
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const response = await fetch('/api/my-investments', { headers: { 'Authorization': `Bearer ${token}` } });
        const investments = await response.json();

        tableBody.innerHTML = '';
        if (investments.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">No tienes inversiones activas.</td></tr>';
            return;
        }

        investments.forEach(inv => {
            const profitClass = inv.profit >= 0 ? 'text-emerald-500' : 'text-red-500';
            const sign = inv.profit >= 0 ? '+' : '';
            
            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5">
                    <td class="p-4 font-bold text-slate-800 dark:text-white">${inv.portfolioName}</td>
                    <td class="p-4 text-sm text-slate-500">${new Date(inv.date).toLocaleDateString()}</td>
                    <td class="p-4 text-right font-mono text-slate-700 dark:text-slate-300">${formatter.format(inv.investedAmount)}</td>
                    <td class="p-4 text-right font-mono font-bold">${formatter.format(inv.currentValue)}</td>
                    <td class="p-4 text-right font-mono ${profitClass}">${sign}${formatter.format(inv.profit)}</td>
                    <td class="p-4 text-center"><span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 font-bold">Activo</span></td>
                    <td class="p-4 text-right"><button onclick="sellInvestment(${inv.id})" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200">Vender</button></td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) { console.error(error); tableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-red-500">Error cargando datos.</td></tr>'; }
});

// Función Global para Vender
window.sellInvestment = async function(id) {
    if(!confirm("¿Seguro que quieres vender esta posición y recuperar el saldo?")) return;
    try {
        const res = await fetch('/api/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ investmentId: id, token: localStorage.getItem('token') })
        });
        if(res.ok) { alert("Venta exitosa"); window.location.reload(); }
        else { alert("Error al vender"); }
    } catch(e) { alert("Error de conexión"); }
}