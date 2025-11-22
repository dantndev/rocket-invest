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
            tableBody.innerHTML = '<tr><td colspan="6" class="p-10 text-center text-slate-500 italic">Aún no tienes movimientos registrados.</td></tr>';
            return;
        }

        transactions.forEach(tx => {
            const isPositive = tx.type === 'deposit' || tx.type === 'sell';
            const color = isPositive ? 'text-emerald-500' : 'text-slate-700 dark:text-white';
            const sign = isPositive ? '+' : '';
            
            // Badge Styles
            let badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
            if(tx.type === 'invest') badgeClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
            if(tx.type === 'deposit') badgeClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400";
            if(tx.type === 'sell') badgeClass = "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400";
            
            const folio = tx.folio || `RI-TXN-${String(tx.id).padStart(6, '0')}`;

            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-4 text-xs font-mono text-slate-400 select-all font-bold">${folio}</td>
                    
                    <td class="p-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        ${new Date(tx.date).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'})}
                        <span class="text-xs text-slate-400 ml-1">${new Date(tx.date).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}</span>
                    </td>
                    
                    <td class="p-4">
                        <span class="uppercase text-[10px] font-bold px-2 py-1 rounded ${badgeClass} tracking-wide">${tx.type}</span>
                    </td>
                    
                    <td class="p-4 text-sm font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate" title="${tx.description}">
                        ${tx.description}
                    </td>
                    
                    <td class="p-4 text-right font-mono font-bold ${color} whitespace-nowrap">
                        ${sign}${formatter.format(tx.amount)}
                    </td>
                    
                    <td class="p-4 text-center">
                        <button onclick="downloadPDF(${tx.id})" class="text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-full transition-all group" title="Descargar Comprobante">
                            <span class="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">description</span>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) { 
        console.error(error); 
        tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-500">Error al cargar el historial.</td></tr>';
    }
});

// Función Global para descargar
window.downloadPDF = function(id) {
    const token = localStorage.getItem('token');
    // Abre la API de PDF en una nueva pestaña de forma segura
    window.open(`/api/contract/${id}?token=${token}`, '_blank');
}