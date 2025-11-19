// public/js/dashboard.js

// --- VARIABLES GLOBALES ---
let investModal, investModalTitle, investModalIdInput;
let depositModal;
let withdrawModal; // Nuevo
// Variables para el Modal de Inversión de 2 Pasos
let step1Div, step2Div, confirmPortfolioName, confirmAmountDisplay, btnFinalConfirm;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. INICIALIZAR REFERENCIAS DEL DOM
    investModal = document.getElementById('invest-modal');
    investModalTitle = document.getElementById('modal-portfolio-name');
    investModalIdInput = document.getElementById('modal-portfolio-id');
    depositModal = document.getElementById('deposit-modal');
    withdrawModal = document.getElementById('withdraw-modal'); // Nuevo

    // Referencias de pasos de inversión
    step1Div = document.getElementById('invest-step-1');
    step2Div = document.getElementById('invest-step-2');
    confirmPortfolioName = document.getElementById('confirm-portfolio-name');
    confirmAmountDisplay = document.getElementById('confirm-amount-display');
    btnFinalConfirm = document.getElementById('btn-final-confirm');

    // --- LÓGICA DE FORMATO DE TARJETA ---
    const cardInput = document.getElementById('card-number');
    if (cardInput) {
        cardInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            value = value.substring(0, 16);
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }

    // --- LÓGICA DE FORMATO DE FECHA ---
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
    renderMarketChart();

    // --- BOTÓN VER TODOS ---
    const btnVerTodos = document.getElementById('btn-ver-todos');
    if(btnVerTodos) {
        btnVerTodos.addEventListener('click', () => {
            window.location.href = 'portfolios.html';
        });
    }

    // --- LISTENERS DE FORMULARIOS ---

    // A) Lógica Modal Inversión (2 PASOS)
    const formStep1 = document.getElementById('investment-form-step1');
    if (formStep1) {
        formStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = document.getElementById('invest-amount').value;
            const portfolioName = investModalTitle.innerText;

            if(amount <= 0) { alert("Ingresa un monto válido"); return; }

            const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
            if(confirmAmountDisplay) confirmAmountDisplay.innerText = formatter.format(amount);
            if(confirmPortfolioName) confirmPortfolioName.innerText = portfolioName;

            if(step1Div && step2Div) {
                step1Div.classList.add('hidden');
                step2Div.classList.remove('hidden');
                step2Div.classList.add('flex');
            }
        });
    }

    if (btnFinalConfirm) {
        btnFinalConfirm.addEventListener('click', async () => {
            const amount = document.getElementById('invest-amount').value;
            const portfolioId = investModalIdInput.value;
            
            btnFinalConfirm.disabled = true;
            btnFinalConfirm.innerText = "Procesando...";

            try {
                const response = await fetch('/api/invest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ portfolioId, amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    closeInvestModal();
                    updateUserData(token); 
                } else {
                    alert('Error: ' + data.message);
                    backToStep1();
                }
            } catch (error) { 
                console.error(error); 
                alert('Error de conexión');
                backToStep1();
            } finally {
                btnFinalConfirm.disabled = false;
                btnFinalConfirm.innerText = "Sí, Invertir";
            }
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
                const response = await fetch('/api/deposit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    closeDepositModal();
                    updateUserData(token);
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

    // C) Formulario de RETIRO (NUEVO)
    const withdrawForm = document.getElementById('withdraw-form');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = document.getElementById('withdraw-amount').value;
            const btn = document.getElementById('btn-confirm-withdraw');
            const originalText = btn.innerText;
            
            btn.disabled = true;
            btn.innerText = "Enviando...";
            await new Promise(r => setTimeout(r, 1000)); 

            try {
                const response = await fetch('/api/withdraw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ amount, token })
                });
                const data = await response.json();

                if (response.ok) {
                    closeWithdrawModal();
                    updateUserData(token);
                    document.getElementById('withdraw-amount').value = '';
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

window.backToStep1 = function() {
    if(step1Div && step2Div) {
        step2Div.classList.add('hidden');
        step2Div.classList.remove('flex');
        step1Div.classList.remove('hidden');
    }
};

window.selectPortfolio = function(id, name) {
    if (!investModal) return;
    if(step1Div && step2Div) {
        step1Div.classList.remove('hidden');
        step2Div.classList.add('hidden');
        step2Div.classList.remove('flex');
        document.getElementById('invest-amount').value = '';
    }
    investModalTitle.innerText = name;
    investModalIdInput.value = id;
    investModal.classList.remove('hidden');
    setTimeout(() => {
        investModal.classList.remove('opacity-0');
        investModal.querySelector('div').classList.remove('scale-95');
        investModal.querySelector('div').classList.add('scale-100');
    }, 10);
};

window.closeModal = function() { closeInvestModal(); };
function closeInvestModal() {
    if (!investModal) return;
    investModal.classList.add('opacity-0');
    investModal.querySelector('div').classList.remove('scale-100');
    investModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { investModal.classList.add('hidden'); }, 300);
}

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

window.closeDepositModal = function() {
    if (!depositModal) return;
    depositModal.classList.add('opacity-0');
    depositModal.querySelector('div').classList.remove('scale-100');
    depositModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { depositModal.classList.add('hidden'); }, 300);
};

// Funciones para Modal de Retiro (NUEVO)
window.openWithdrawModal = function() {
    if (!withdrawModal) withdrawModal = document.getElementById('withdraw-modal');
    if (!withdrawModal) return;

    // Actualizar saldo disponible en el modal de retiro
    const balanceText = document.getElementById('display-available')?.innerText || "$0.00";
    const modalBalance = document.getElementById('withdraw-max-balance');
    if(modalBalance) modalBalance.innerText = balanceText;

    withdrawModal.classList.remove('hidden');
    setTimeout(() => {
        withdrawModal.classList.remove('opacity-0');
        withdrawModal.querySelector('div').classList.remove('scale-95');
        withdrawModal.querySelector('div').classList.add('scale-100');
    }, 10);
};

window.closeWithdrawModal = function() {
    if (!withdrawModal) return;
    withdrawModal.classList.add('opacity-0');
    withdrawModal.querySelector('div').classList.remove('scale-100');
    withdrawModal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { withdrawModal.classList.add('hidden'); }, 300);
};


// --- FUNCIONES DE CARGA DE DATOS ---

async function updateUserData(token) {
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const userData = await response.json();
            updateBalanceUI(userData);
        }
    } catch (error) { console.error("Error cargando usuario", error); }
}

function updateBalanceUI(data) {
    const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    const elNetWorth = document.getElementById('display-net-worth');
    if (elNetWorth) elNetWorth.innerHTML = `${formatter.format(data.netWorth)} <span class="text-2xl text-slate-400 font-normal">MXN</span>`;

    const elAvailable = document.getElementById('display-available');
    if (elAvailable) elAvailable.innerText = formatter.format(data.availableBalance);

    const elInvested = document.getElementById('display-invested');
    if (elInvested) elInvested.innerText = formatter.format(data.investedAmount);

    const elProfit = document.getElementById('display-profit');
    if (elProfit) {
        const sign = data.profit >= 0 ? '+' : '';
        elProfit.innerText = `${sign}${formatter.format(data.profit)}`;
        elProfit.className = data.profit < 0 ? "text-red-500 font-bold text-lg" : "text-emerald-600 dark:text-emerald-400 font-bold text-lg";
    }

    const modalBalance = document.querySelector('#investment-form-step1 p.text-xs.text-right');
    if(modalBalance) modalBalance.innerText = `Disponible para invertir: ${formatter.format(data.availableBalance)}`;
}

async function loadPortfolios() {
    try {
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        const gridContainer = document.getElementById('portfolio-grid');
        if(!gridContainer) return;
        
        gridContainer.innerHTML = ''; 

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

async function renderMarketChart() {
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;

    try {
        // 1. Pedir datos reales al servidor
        const response = await fetch('/api/market');
        const marketData = await response.json();

        // 2. Procesar fechas (Convertir timestamps a texto legible 'Ene 24')
        const labels = marketData.dates.map(timestamp => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        });

        // 3. Configuración de colores
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const lineColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';

        // 4. Dibujar Gráfica
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'S&P 500 (SPY)',
                    data: marketData.prices,
                    borderColor: '#307de8',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(48, 125, 232, 0.2)');
                        gradient.addColorStop(1, 'rgba(48, 125, 232, 0)');
                        return gradient;
                    },
                    borderWidth: 2,
                    tension: 0.1, // Líneas más precisas para datos financieros
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
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
                        callbacks: { label: function(context) { return '$' + context.parsed.y.toFixed(2); } }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                hover: { mode: 'index', intersect: false },
                scales: {
                    y: { 
                        grid: { color: gridColor, borderDash: [5, 5] }, 
                        ticks: { color: textColor, callback: (v) => '$' + v }, 
                        border: { display: false } 
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { color: textColor, maxTicksLimit: 6 }, // Limitar etiquetas para que no se amontonen
                        border: { display: false } 
                    }
                }
            }
        });
    } catch (e) {
        console.error("Error renderizando gráfica:", e);
    }
}