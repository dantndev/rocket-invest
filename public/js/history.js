document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const tableBody = document.getElementById('history-table-body');
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const response = await fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();

        tableBody.innerHTML = '';
        if (data.length === 0) { tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">Sin movimientos.</td></tr>'; return; }

        data.forEach(tx => {
            const isPos = tx.type==='deposit'||tx.type==='sell';
            const color = isPos ? 'text-emerald-500' : 'text-slate-700 dark:text-white';
            const sign = isPos ? '+' : '';
            const folio = tx.folio || `RI-${tx.id}`;

            tableBody.innerHTML += `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5">
                    <td class="p-4 text-xs font-mono text-slate-400 font-bold">${folio}</td>
                    <td class="p-4 text-sm text-slate-500">${new Date(tx.date).toLocaleDateString()}</td>
                    <td class="p-4"><span class="uppercase text-[10px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">${tx.type}</span></td>
                    <td class="p-4 text-sm font-medium max-w-xs truncate">${tx.description}</td>
                    <td class="p-4 text-right font-mono font-bold ${color}">${sign}${formatter.format(tx.amount)}</td>
                    <td class="p-4 text-center"><button onclick="window.open('/api/contract/${tx.id}?token=${token}','_blank')" class="text-slate-400 hover:text-primary p-2"><span class="material-symbols-outlined text-lg">description</span></button></td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-500">Error al cargar.</td></tr>'; }
});