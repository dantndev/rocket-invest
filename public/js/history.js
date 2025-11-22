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
            tableBody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">Sin movimientos recientes.</td></tr>';
            return;
        }

        transactions.forEach(tx => {
            const isPositive = tx.type === 'deposit' || tx.type === 'sell';
            const color = isPositive ? 'text-emerald-500' : 'text-slate-700 dark:text-white';
            const sign = isPositive ? '+' : '';
            const badgeColor = isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
            
            // USAMOS EL FOLIO QUE MANDA EL SERVIDOR
            const folio = tx.folio || `RI-TXN-${tx.id}`;

            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-4 text-xs font-mono text-slate-400 select-all">${folio}</td>
                    <td class="p-4 text-sm text-slate-500">${new Date(tx.date).toLocaleDateString()}</td>
                    <td class="p-4"><span class="uppercase text-[10px] font-bold px-2 py-1 rounded ${badgeColor}">${tx.type}</span></td>
                    <td class="p-4 text-sm font-medium text-slate-800 dark:text-slate-200">${tx.description}</td>
                    <td class="p-4 text-right font-mono font-bold ${color}">${sign}${formatter.format(tx.amount)}</td>
                    <td class="p-4 text-center">
                        <button onclick="downloadPDF(${tx.id})" class="text-slate-400 hover:text-primary transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Descargar Comprobante Oficial">
                            <span class="material-symbols-outlined text-lg">description</span>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) { console.error(error); }
});

window.downloadPDF = function(id) {
    const token = localStorage.getItem('token');
    window.open(`/api/contract/${id}?token=${token}`, '_blank');
}