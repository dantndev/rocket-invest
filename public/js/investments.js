// public/js/investments.js

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- Lógica de Tema (Oscuro/Claro) ---
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

    // --- SEGURIDAD ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // --- CARGAR INVERSIONES ---
    const tableBody = document.getElementById('investments-table-body');
    const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        // ⚠️ CORRECCIÓN AQUÍ: Usamos ruta relativa '/api/...' en lugar de 'http://localhost...'
        const response = await fetch('/api/my-investments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error de red');

        const investments = await response.json();

        tableBody.innerHTML = ''; // Limpiar mensaje de carga

        if (investments.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-slate-500 dark:text-slate-400">
                        Aún no tienes inversiones. 
                        <a href="portfolios.html" class="text-primary hover:underline font-bold">Ve a explorar</a>
                    </td>
                </tr>`;
            return;
        }

        investments.forEach(inv => {
            // Lógica visual (Colores de ganancia)
            const profitColor = inv.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500';
            const profitSign = inv.profit >= 0 ? '+' : '';

            // Fila de la tabla
            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-5">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-900 dark:text-white text-sm md:text-base">${inv.portfolioName}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400">Riesgo ${inv.risk}</span>
                        </div>
                    </td>
                    <td class="p-5 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        ${currencyFormatter.format(inv.investedAmount)}
                    </td>
                    <td class="p-5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        ${currencyFormatter.format(inv.currentValue)}
                    </td>
                    <td class="p-5 text-right font-bold ${profitColor} whitespace-nowrap">
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
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-red-500">
                    No se pudieron cargar tus datos. <br>
                    <span class="text-xs text-slate-400">Intenta recargar la página.</span>
                </td>
            </tr>`;
    }

    // Logout Logic Sidebar
    const logoutBtn = document.getElementById('logout-sidebar-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        });
    }
});