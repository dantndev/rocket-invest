// public/js/history.js

document.addEventListener('DOMContentLoaded', async () => {
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const tableBody = document.getElementById('history-table-body');
    const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        // Petición al Backend (Ruta relativa)
        const response = await fetch('/api/transactions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error de red');

        const transactions = await response.json();
        tableBody.innerHTML = ''; 

        if (transactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="p-8 text-center text-slate-500 dark:text-slate-400">
                        No hay movimientos registrados.
                    </td>
                </tr>`;
            return;
        }

        transactions.forEach(tx => {
            // 1. Formato de Fecha
            const dateObj = new Date(tx.date);
            const dateStr = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
            const timeStr = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

            // 2. Estilos por Tipo
            let typeBadgeClass = '';
            let typeLabel = '';
            let amountClass = '';
            let amountPrefix = '';

            if (tx.type === 'deposit' || tx.type === 'sell') {
                // ENTRADAS (Verde)
                typeBadgeClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
                typeLabel = tx.type === 'deposit' ? 'Depósito' : 'Venta';
                amountClass = 'text-emerald-600 dark:text-emerald-400';
                amountPrefix = '+';
            } else {
                // SALIDAS (Negro/Blanco)
                typeBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
                typeLabel = tx.type === 'invest' ? 'Inversión' : 'Retiro';
                amountClass = 'text-slate-900 dark:text-white';
                amountPrefix = ''; // Viene negativo
            }

            // 3. Renderizar Fila
            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-5 whitespace-nowrap">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-700 dark:text-slate-300 text-sm">${dateStr}</span>
                            <span class="text-xs opacity-60">${timeStr}</span>
                        </div>
                    </td>
                    
                    <td class="p-5 whitespace-nowrap">
                        <span class="px-3 py-1 text-xs font-bold rounded-full ${typeBadgeClass}">
                            ${typeLabel}
                        </span>
                    </td>

                    <td class="p-5 text-sm text-slate-600 dark:text-slate-300 font-medium">
                        ${tx.description}
                    </td>

                    <td class="p-5 text-right font-bold ${amountClass} whitespace-nowrap">
                        ${amountPrefix}${currencyFormatter.format(tx.amount)}
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500">Error cargando historial.</td></tr>`;
    }
});