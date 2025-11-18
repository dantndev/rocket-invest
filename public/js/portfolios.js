// public/js/portfolios.js

let modal, modalTitle, modalIdInput;

document.addEventListener('DOMContentLoaded', async () => {
    
    modal = document.getElementById('invest-modal');
    modalTitle = document.getElementById('modal-portfolio-name');
    modalIdInput = document.getElementById('modal-portfolio-id');
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Cargar datos
    await updateUserData(token);
    loadAllPortfolios();

    // Listener Formulario Inversión
    const investmentForm = document.getElementById('investment-form');
    if (investmentForm) {
        investmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('invest-amount').value;
            const portfolioId = modalIdInput.value;

            try {
                // RUTA RELATIVA CORREGIDA
                const response = await fetch('/api/invest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ portfolioId, amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    //alert(`¡Éxito! Has invertido $${amount} MXN.`);
                    closeModal();
                    updateUserData(token);
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (error) { console.error(error); alert('Error de conexión'); }
        });
    }
});

async function updateUserData(token) {
    try {
        // RUTA RELATIVA CORREGIDA
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const user = await response.json();
            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
            const balanceSpan = document.getElementById('modal-balance-display');
            if(balanceSpan) balanceSpan.innerText = formatter.format(user.balance);
        }
    } catch (error) { console.error("Error cargando usuario", error); }
}

async function loadAllPortfolios() {
    try {
        // RUTA RELATIVA CORREGIDA
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const gridContainer = document.getElementById('portfolio-grid');
        
        if(!gridContainer) return;
        gridContainer.innerHTML = ''; 

        // Renderizar TODOS los portafolios (Sin slice)
        portfolios.forEach(portfolio => {
            // Lógica de Colores
            let riskColorBg = portfolio.risk === 'Alto' ? 'bg-red-100 dark:bg-red-500/10' : (portfolio.risk === 'Medio' ? 'bg-orange-100 dark:bg-orange-500/10' : 'bg-green-100 dark:bg-green-500/10');
            let riskColorText = portfolio.risk === 'Alto' ? 'text-red-600 dark:text-red-400' : (portfolio.risk === 'Medio' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400');
            let riskBorder = portfolio.risk === 'Alto' ? 'border-red-200 dark:border-red-500/20' : (portfolio.risk === 'Medio' ? 'border-orange-200 dark:border-orange-500/20' : 'border-green-200 dark:border-green-500/20');
            
            // Iconos variados para que no se vea repetitivo
            const icons = ['🚀', '💻', '🌍', '🌱', '💎', '🏗️', '🇺🇸', '🎮', '🏆'];
            const icon = icons[(portfolio.id - 1) % icons.length];

            const cardHTML = `
                <div class="flex flex-col p-6 bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary dark:hover:border-primary/50 hover:shadow-lg transition-all duration-300 group h-full">
                    <div class="flex justify-between items-start mb-4">
                        <div class="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors">${icon}</div>
                        <span class="px-3 py-1 text-xs font-bold rounded-full ${riskColorBg} ${riskColorText} border ${riskBorder}">Riesgo ${portfolio.risk}</span>
                    </div>
                    <h3 class="text-slate-900 dark:text-white text-lg font-bold mb-1">${portfolio.name}</h3>
                    <p class="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-2">${portfolio.description}</p>
                    <div class="mt-auto">
                        <div class="flex items-end gap-2 mb-6">
                            <p class="text-4xl font-bold text-green-600 dark:text-emerald-400">+${portfolio.returnYTD}%</p>
                            <p class="text-slate-400 text-sm font-medium mb-1">Rendimiento (YTD)</p>
                        </div>
                        <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
                            <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                                <span class="material-symbols-outlined text-base">group</span>
                                <span>${portfolio.users} inv.</span>
                            </div>
                            <button onclick="selectPortfolio(${portfolio.id}, '${portfolio.name}')" class="px-5 py-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-primary hover:text-white transition-colors">Invertir Ahora</button>
                        </div>
                    </div>
                </div>
            `;
            gridContainer.innerHTML += cardHTML;
        });
    } catch (error) { 
        console.error(error);
        const grid = document.getElementById('portfolio-grid');
        if(grid) grid.innerHTML = '<p class="col-span-3 text-center text-red-500 p-10">Error cargando portafolios.</p>';
    }
}

// Funciones Globales
window.selectPortfolio = function(id, name) {
    if (!modal) return;
    modalTitle.innerText = name;
    modalIdInput.value = id;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
};

window.closeModal = function() {
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
};