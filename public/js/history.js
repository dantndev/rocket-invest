// public/js/history.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }
    const tbody = document.getElementById('history-table-body');
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const res = await fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        tbody.innerHTML = '';
        if(data.length===0) { tbody.innerHTML='<tr><td colspan="6" class="p-8 text-center text-slate-500">Vacío.</td></tr>'; return; }

        data.forEach(tx => {
            const folio = tx.folio || `RI-${tx.id}`;
            const isPos = tx.type==='deposit'||tx.type==='sell';
            const color = isPos ? 'text-emerald-500' : 'text-slate-700 dark:text-white';
            const badge = tx.type==='invest'?'bg-blue-50 text-blue-600':(tx.type==='deposit'?'bg-emerald-50 text-emerald-600':'bg-slate-100 text-slate-600');
            
            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-slate-700">
                    <td class="p-4 text-xs font-mono text-slate-400">${folio}</td>
                    <td class="p-4 text-sm text-slate-500">${new Date(tx.date).toLocaleDateString()}</td>
                    <td class="p-4"><span class="uppercase text-[10px] font-bold px-2 py-1 rounded ${badge}">${tx.type}</span></td>
                    <td class="p-4 text-sm font-medium truncate max-w-xs dark:text-white">${tx.description}</td>
                    <td class="p-4 text-right font-mono font-bold ${color}">${isPos?'+':''}${fmt.format(tx.amount)}</td>
                    <td class="p-4 text-center"><button onclick="window.open('/api/contract/${tx.id}?token=${token}','_blank')" class="text-slate-400 hover:text-primary p-2"><span class="material-symbols-outlined">description</span></button></td>
                </tr>`;
        });
    } catch(e){ console.error(e); }
});