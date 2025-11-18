// public/js/investments.js

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- Lógica de Tema (Copiada para consistencia) ---
    const html = document.documentElement;
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
    }
    if(themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            html.classList.toggle('dark');
            localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
        });
    }

    // --- Cargar Inversiones ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const tableBody = document.getElementById('investments-table-body');
    const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const response = await fetch('http://localhost:3000/api/my-investments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const investments = await response.json();

        tableBody.innerHTML = ''; // Limpiar carga

        if (investments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">Aún no tienes inversiones. <a href="dashboard.html" class="text-primary hover:underline">Ve a explorar</a></td></tr>`;
            return;
        }

        investments.forEach(inv => {
            // Color de ganancia (Verde si es positivo)
            const profitColor = inv.profit >= 0 ? 'text-emerald-500' : 'text-red-500';
            const profitSign = inv.profit >= 0 ? '+' : '';

            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-5">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-900 dark:text-white">${inv.portfolioName}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400">Riesgo ${inv.risk}</span>
                        </div>
                    </td>
                    <td class="p-5 text-right font-medium text-slate-700 dark:text-slate-300">
                        ${currencyFormatter.format(inv.investedAmount)}
                    </td>
                    <td class="p-5 text-right font-bold text-slate-900 dark:text-white">
                        ${currencyFormatter.format(inv.currentValue)}
                    </td>
                    <td class="p-5 text-right font-bold ${profitColor}">
                        ${profitSign}${currencyFormatter.format(inv.profit)}
                    </td>
                    <td class="p-5 text-center">
                        <span class="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                            Activo
                        </span>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Error cargando datos.</td></tr>`;
    }

    // Logout
    document.getElementById('logout-sidebar-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });
});