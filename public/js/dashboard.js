// public/js/dashboard.js

// --- VARIABLES GLOBALES ---
let investModal, investModalTitle, investModalIdInput;
let depositModal; 

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. INICIALIZAR REFERENCIAS DEL DOM
    investModal = document.getElementById('invest-modal');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    depositModal = document.getElementById('deposit-modal');

    // --- LOGICA DE FORMATO DE TARJETA ---
    const cardInput = document.getElementById('card-number');
    if (cardInput) {
        cardInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, ''); // Solo números
            value = value.substring(0, 16); // Max 16
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value; // Grupos de 4
            e.target.value = formattedValue;
        });
    }

    // --- LOGICA DE FORMATO DE FECHA ---
    const expiryInput = document.getElementById('card-expiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 4) value = value.substring(0, 4);
            if (value.length > 2) {
                value = value.substring(0, 2) + '/' + value.substring(2);
            }
            e.target.value = value;
        });
    }

    // --- SEGURIDAD ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // 2. CARGAR DATOS INICIALES
    await updateUserData(token);
    loadPortfolios();

    // 3. RENDERIZAR GRÁFICA (Chart.js)
    renderMarketChart();

    // --- 6. BOTÓN VER TODOS ---
    const btnVerTodos = document.getElementById('btn-ver-todos');
    if(btnVerTodos) {
        btnVerTodos.addEventListener('click', () => {
            // Navegar a la página de portafolios
            window.location.href = 'portfolios.html';
        });
    }

    // --- LISTENERS DE FORMULARIOS ---

    // A) Formulario de INVERSIÓN
    const investmentForm = document.getElementById('investment-form');
    if (investmentForm) {
        investmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('invest-amount').value;
            const portfolioId = investModalIdInput.value;

            try {
                // RUTA RELATIVA
                const response = await fetch('/api/invest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ portfolioId, amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    // ÉXITO SIN ALERTA INTRUSIVA
                    closeInvestModal();
                    // RECARGAR TODOS LOS DATOS (Para evitar NaN)
                    updateUserData(token); 
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (error) { console.error(error); alert('Error de conexión'); }
        });
    }

    // B) Formulario de DEPÓSITO
    const depositForm = document.getElementById('deposit-form');
    if (depositForm) {
        depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const amount = document.getElementById('deposit-amount').value;
            const btn = document.getElementById('btn-confirm-deposit');
            const originalText = btn.innerText;
            
            btn.disabled = true;
            btn.innerText = "Procesando...";
            await new Promise(r => setTimeout(r, 1000)); 

            try {
                // RUTA RELATIVA
                const response = await fetch('/api/deposit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    // ÉXITO SIN ALERTA INTRUSIVA
                    closeDepositModal();
                    // RECARGAR TODOS LOS DATOS
                    updateUserData(token);
                    
                    // Limpiar formulario
                    document.getElementById('deposit-amount').value = '';
                    if(cardInput) cardInput.value = '';
                    if(expiryInput) expiryInput.value = '';
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (error) { console.error(error); alert('Error de conexión'); } 
            finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        });
    }
});

// --- FUNCIONES GLOBALES ---

// 1. Abrir Modal Inversión
window.selectPortfolio = function(id, name) {
    if (!investModal) return;
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.classList.remove('hidden');
    setTimeout(() => {
        investModal.classList.remove('opacity-0');
        investModal.querySelector('div').classList.remove('scale-95');
        investModal.querySelector('div').classList.add('scale-100');
    }, 10);
};

// 2. Cerrar Modal Inversión
window.closeModal = function() { 
    closeInvestModal();
};

function closeInvestModal() {
    if (!investModal) return;
    investModal.classList.add('opacity-0');
    investModal.querySelector('div').classList.remove('scale-100');
    investModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { investModal.classList.add('hidden'); }, 300);
}

// 3. Abrir Modal Depósito
window.openDepositModal = function() {
    if (!depositModal) depositModal = document.getElementById('deposit-modal');
    if (!depositModal) return;

    depositModal.classList.remove('hidden');
    setTimeout(() => {
        depositModal.classList.remove('opacity-0');
        depositModal.querySelector('div').classList.remove('scale-95');
        depositModal.querySelector('div').classList.add('scale-100');
    }, 10);
};

// 4. Cerrar Modal Depósito
window.closeDepositModal = function() {
    if (!depositModal) return;
    depositModal.classList.add('opacity-0');
    depositModal.querySelector('div').classList.remove('scale-100');
    depositModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { depositModal.classList.add('hidden'); }, 300);
};


// --- FUNCIONES DE SOPORTE ---

async function updateUserData(token) {
    try {
        // RUTA RELATIVA
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const userData = await response.json();
            updateBalanceUI(userData); // Pasamos el objeto completo
        }
    } catch (error) { console.error("Error cargando usuario", error); }
}

function updateBalanceUI(data) {
    // data contiene: { availableBalance, investedAmount, profit, netWorth }
    
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    // 1. Patrimonio Total (Grande)
    const elNetWorth = document.getElementById('display-net-worth');
    if (elNetWorth) {
        elNetWorth.innerHTML = `${formatter.format(data.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`;
    }

    // 2. Disponible (Efectivo)
    const elAvailable = document.getElementById('display-available');
    if (elAvailable) elAvailable.innerText = formatter.format(data.availableBalance);

    // 3. Invertido
    const elInvested = document.getElementById('display-invested');
    if (elInvested) elInvested.innerText = formatter.format(data.investedAmount);

    // 4. Ganancia (Con color dinámico)
    const elProfit = document.getElementById('display-profit');
    if (elProfit) {
        const sign = data.profit >= 0 ? '+' : '';
        elProfit.innerText = `${sign}${formatter.format(data.profit)}`;
        if (data.profit < 0) {
            elProfit.className = "text-red-500 font-bold text-lg";
        } else {
            elProfit.className = "text-emerald-600 dark:text-emerald-400 font-bold text-lg";
        }
    }

    // 5. Actualizar texto pequeño del Modal
    const modalBalance = document.querySelector('#investment-form p.text-xs.text-right');
    if(modalBalance) modalBalance.innerText = `Disponible para invertir: ${formatter.format(data.availableBalance)}`;
}

async function loadPortfolios() {
    try {
        // RUTA RELATIVA
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const gridContainer = document.getElementById('portfolio-grid');
        if(!gridContainer) return;
        
        gridContainer.innerHTML = ''; 

        // SLICE: Solo mostramos los primeros 3 en el dashboard
        portfolios.slice(0, 3).forEach(portfolio => {
            let riskColorBg = portfolio.risk === 'Alto' ? 'bg-red-100 dark:bg-red-500/10' : (portfolio.risk === 'Medio' ? 'bg-orange-100 dark:bg-orange-500/10' : 'bg-green-100 dark:bg-green-500/10');
            let riskColorText = portfolio.risk === 'Alto' ? 'text-red-600 dark:text-red-400' : (portfolio.risk === 'Medio' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400');
            let riskBorder = portfolio.risk === 'Alto' ? 'border-red-200 dark:border-red-500/20' : (portfolio.risk === 'Medio' ? 'border-orange-200 dark:border-orange-500/20' : 'border-green-200 dark:border-green-500/20');
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
    } catch (error) { console.error(error); }
}

function renderMarketChart() {
    const ctx = document.getElementById('marketChart');
    if (ctx) {
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const lineColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                datasets: [{
                    label: 'Rendimiento',
                    data: [12, 15, 14, 22, 28, 35],
                    borderColor: '#307de8',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(48, 125, 232, 0.2)');
                        gradient.addColorStop(1, 'rgba(48, 125, 232, 0)');
                        return gradient;
                    },
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            plugins: [{
                id: 'verticalHoverLine',
                afterDatasetsDraw: (chart) => {
                    if (chart.tooltip?._active?.length) {
                        const x = chart.tooltip._active[0].element.x;
                        const yAxis = chart.scales.y;
                        const ctx = chart.ctx;
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(x, yAxis.top);
                        ctx.lineTo(x, yAxis.bottom);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = lineColor;
                        ctx.setLineDash([5, 5]);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        titleColor: isDark ? '#ffffff' : '#0f172a',
                        bodyColor: isDark ? '#cbd5e1' : '#475569',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: { label: function(context) { return 'Rendimiento: ' + context.parsed.y + '%'; } }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                hover: { mode: 'index', intersect: false },
                scales: {
                    y: { grid: { color: gridColor, borderDash: [5, 5] }, ticks: { color: textColor, callback: (v) => v + '%' }, border: { display: false } },
                    x: { grid: { display: false }, ticks: { color: textColor }, border: { display: false } }
                }
            }
        });
    }
}