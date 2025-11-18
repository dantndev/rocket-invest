// public/js/investments.js

let sellModal, sellAmountDisplay, btnConfirmSell;
let investmentIdToSell = null;

document.addEventListener('DOMContentLoaded', async () => {
    
    // Referencias del Modal de Venta
    sellModal = document.getElementById('sell-modal');
    sellAmountDisplay = document.getElementById('sell-amount-display');
    btnConfirmSell = document.getElementById('btn-confirm-sell');

    // Listener para confirmar venta
    if (btnConfirmSell) {
        btnConfirmSell.addEventListener('click', executeSale);
    }

    // Seguridad
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Cargar Inversiones
    loadInvestments(token);

    // Logout Logic
    const logoutBtn = document.getElementById('logout-sidebar-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        });
    }
});

// Función Global: Abrir Modal
window.openSellModal = function(id, estimatedValue) {
    investmentIdToSell = id; // Guardamos el ID para usarlo al confirmar
    
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    if(sellAmountDisplay) sellAmountDisplay.innerText = formatter.format(estimatedValue);

    if (sellModal) {
        sellModal.classList.remove('hidden');
        setTimeout(() => {
            sellModal.classList.remove('opacity-0');
            sellModal.querySelector('div').classList.remove('scale-95');
            sellModal.querySelector('div').classList.add('scale-100');
        }, 10);
    }
};

// Función Global: Cerrar Modal
window.closeSellModal = function() {
    investmentIdToSell = null;
    if (sellModal) {
        sellModal.classList.add('opacity-0');
        sellModal.querySelector('div').classList.remove('scale-100');
        sellModal.querySelector('div').classList.add('scale-95');
        setTimeout(() => { sellModal.classList.add('hidden'); }, 300);
    }
};

// Ejecutar la venta (Al dar clic en Confirmar)
async function executeSale() {
    if (!investmentIdToSell) return;
    
    const token = localStorage.getItem('token');
    const btn = document.getElementById('btn-confirm-sell');
    const originalText = btn.innerText;

    btn.disabled = true;
    btn.innerText = "Vendiendo...";

    try {
        const response = await fetch('/api/sell', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ investmentId: investmentIdToSell, token })
        });

        const data = await response.json();

        if (response.ok) {
            closeSellModal();
            loadInvestments(token); // Recargar tabla
            // Opcional: Mostrar notificación de éxito
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function loadInvestments(token) {
    const tableBody = document.getElementById('investments-table-body');
    const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    try {
        const response = await fetch('/api/my-investments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error de red');

        const investments = await response.json();
        if(!tableBody) return;
        
        tableBody.innerHTML = ''; 

        if (investments.length === 0) {
            // colspan="7" porque agregamos una columna
            tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500 dark:text-slate-400">Aún no tienes inversiones. <a href="portfolios.html" class="text-primary hover:underline font-bold">Ve a explorar</a></td></tr>`;
            return;
        }

        investments.forEach(inv => {
            const profitColor = inv.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500';
            const profitSign = inv.profit >= 0 ? '+' : '';
            
            // --- FORMATO DE FECHA ---
            const dateObj = new Date(inv.date);
            const dateStr = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
            const timeStr = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

            const row = `
                <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="p-5">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-900 dark:text-white text-sm md:text-base">${inv.portfolioName}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400">Riesgo ${inv.risk}</span>
                        </div>
                    </td>
                    
                    <td class="p-5 text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-700 dark:text-slate-300">${dateStr}</span>
                            <span class="text-xs opacity-70">${timeStr}</span>
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
                    <td class="p-5 text-right">
                        <button onclick="openSellModal(${inv.id}, ${inv.currentValue})" class="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-lg shadow-sm transition-all whitespace-nowrap">
                            Retirar / Vender
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error(error);
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">Error cargando datos.</td></tr>`;
    }
}