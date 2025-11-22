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
            
            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5">
                    <td class="p-4 font-bold text-slate-900 dark:text-white">${inv.portfolioName}</td>
                    <td class="p-4 text-sm text-slate-500">${new Date(inv.date).toLocaleDateString()}</td>
                    <td class="p-4 text-right font-mono text-slate-600 dark:text-slate-300">${formatter.format(inv.investedAmount)}</td>
                    <td class="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">${formatter.format(inv.currentValue)}</td>
                    <td class="p-4 text-right font-mono font-bold ${profitClass}">${formatter.format(inv.profit)}</td>
                    <td class="p-4 text-center"><span class="px-2 py-1 rounded-md text-xs bg-emerald-100 text-emerald-700 font-bold">Activo</span></td>
                    <td class="p-4 text-right"><button onclick="alert('Función de venta en proceso')" class="text-xs font-bold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">Vender</button></td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) { console.error(error); tableBody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-red-500">Error al cargar.</td></tr>'; }
});