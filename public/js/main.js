// public/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Animaciones
    gsap.from("h1", { duration: 1, y: 50, opacity: 0, ease: "power3.out" });
    gsap.from("p.text-lg", { duration: 1, y: 30, opacity: 0, delay: 0.2, ease: "power3.out" });

    // 2. Cargar Ticker
    loadTicker();
    simulateLiveStats();

    // 3. CHECK DE SESIÓN (NUEVO)
    checkSession();
});

function checkSession() {
    const token = localStorage.getItem('token');
    if (token) {
        // Si hay sesión, cambiamos los botones del Navbar
        const navContainer = document.querySelector('nav .flex.gap-4');
        if (navContainer) {
            navContainer.innerHTML = `
                <a href="dashboard.html" class="px-5 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-full transition-all shadow-lg shadow-primary/25 flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">dashboard</span>
                    Ir al Dashboard
                </a>
            `;
        }
    }
}

async function loadTicker() {
    const tickerContainer = document.getElementById('market-ticker');
    if (!tickerContainer) return;
    
    const symbols = [
        { s: 'AAPL', p: 175.30, c: '+1.2%' }, { s: 'QQQ', p: 368.40, c: '+0.8%' },
        { s: 'SPY', p: 445.20, c: '+0.5%' }, { s: 'TSLA', p: 240.50, c: '-1.1%' },
        { s: 'NVDA', p: 460.10, c: '+2.3%' }, { s: 'BTC', p: 36500, c: '+3.4%' },
        { s: 'ETH', p: 1920, c: '+1.8%' }, { s: 'AMZN', p: 128.40, c: '+0.4%' }
    ];
    
    // Duplicar para scroll infinito fluido
    const displaySymbols = [...symbols, ...symbols, ...symbols]; 
    
    tickerContainer.innerHTML = displaySymbols.map(s => {
        const color = s.c.includes('+') ? 'text-emerald-500' : 'text-red-500';
        const icon = s.c.includes('+') ? 'north_east' : 'south_east';
        return `
            <div class="flex items-center gap-3 px-8 border-r border-slate-200 dark:border-white/5 min-w-max">
                <span class="font-bold text-slate-700 dark:text-white text-sm">${s.s}</span>
                <span class="text-slate-500 dark:text-slate-400 text-sm font-mono">$${s.p}</span>
                <span class="${color} text-xs flex items-center font-bold bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                    <span class="material-symbols-outlined text-[10px] mr-1">${icon}</span>${s.c}
                </span>
            </div>
        `;
    }).join('');
}

function simulateLiveStats() {
    animateValue("stat-users", 0, 1240, 2000);
    animateValue("stat-aum", 0, 15, 2000, "M+");
}

function animateValue(id, start, end, duration, suffix = "") {
    const obj = document.getElementById(id);
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const val = Math.floor(ease * (end - start) + start);
        obj.innerHTML = val.toLocaleString('es-MX') + (suffix ? `<span class="text-primary text-2xl ml-1">${suffix}</span>` : "");
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}