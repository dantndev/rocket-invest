// public/js/history.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const tableBody = document.getElementById('history-table-body');
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const response = await fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
        const transactions = await response.json();

        tableBody.innerHTML = '';
        if (transactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500">Sin movimientos recientes.</td></tr>';
            return;
        }

        transactions.forEach(tx => {
            const isPositive = tx.type === 'deposit' || tx.type === 'sell';
            const color = isPositive ? 'text-emerald-500' : 'text-slate-700 dark:text-white';
            const sign = isPositive ? '+' : '';
            
            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700">
                    <td class="p-4 text-sm text-slate-500">${new Date(tx.date).toLocaleString()}</td>
                    <td class="p-4"><span class="uppercase text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">${tx.type}</span></td>
                    <td class="p-4 text-sm font-medium text-slate-800 dark:text-slate-200">${tx.description}</td>
                    <td class="p-4 text-right font-mono font-bold ${color}">${sign}${formatter.format(tx.amount)}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) { console.error(error); }
});