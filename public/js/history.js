// public/js/history.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const tableBody = document.getElementById('history-table-body');
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const response = await fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
        if(!response.ok) throw new Error("Error API");
        const transactions = await response.json();

        tableBody.innerHTML = '';
        if (transactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">Sin movimientos recientes.</td></tr>';
            return;
        }

        transactions.forEach(tx => {
            const isPos = tx.type==='deposit'||tx.type==='sell';
            const color = isPos ? 'text-emerald-500' : 'text-slate-700 dark:text-white';
            const sign = isPos ? '+' : '';
            const badge = tx.type==='invest'?'bg-blue-50 text-blue-600':(tx.type==='deposit'?'bg-emerald-50 text-emerald-600':'bg-slate-100 text-slate-600');
            const folio = tx.folio || `RI-GEN-${tx.id}`;

            tableBody.innerHTML += `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-4 text-xs font-mono text-slate-400 font-bold">${folio}</td>
                    <td class="p-4 text-sm text-slate-500 whitespace-nowrap">${new Date(tx.date).toLocaleDateString()}</td>
                    <td class="p-4"><span class="uppercase text-[10px] font-bold px-2 py-1 rounded ${badge}">${tx.type}</span></td>
                    <td class="p-4 text-sm font-medium max-w-xs truncate">${tx.description}</td>
                    <td class="p-4 text-right font-mono font-bold ${color}">${sign}${fmt.format(tx.amount)}</td>
                    <td class="p-4 text-center">
                        <button onclick="window.open('/api/contract/${tx.id}?token=${token}','_blank')" class="text-slate-400 hover:text-primary p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><span class="material-symbols-outlined text-lg">description</span></button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { 
        console.error(e); 
        tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-500">Error al cargar el historial.</td></tr>'; 
    }
});