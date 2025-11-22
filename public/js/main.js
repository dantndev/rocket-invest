document.addEventListener('DOMContentLoaded', async () => {
    // 1. ANIMACIÓN DE ENTRADA
    gsap.from("h1", { duration: 1, y: 50, opacity: 0, ease: "power3.out" });
    gsap.from("p.text-lg", { duration: 1, y: 30, opacity: 0, delay: 0.2, ease: "power3.out" });

    // 2. CARGAR DATOS TICKER
    loadTicker();

    // 3. SIMULAR DATOS EN VIVO (Para la landing pública)
    // Usamos animación de conteo para hacerlo visualmente atractivo
    animateValue("stat-users", 0, 1240, 2500); // Simulado inicial
    animateValue("stat-aum", 0, 15, 2500, "M+"); // 15 Millones+
});

async function loadTicker() {
    const tickerContainer = document.getElementById('market-ticker');
    if (!tickerContainer) return;

    // Datos estáticos para la demo (Rápidos y seguros)
    // En producción conectarías a tu API, pero para el marquee visual esto es mejor
    const symbols = [
        { s: 'AAPL', p: 175.30, c: '+1.2%' },
        { s: 'QQQ', p: 368.40, c: '+0.8%' },
        { s: 'SPY', p: 445.20, c: '+0.5%' },
        { s: 'TSLA', p: 240.50, c: '-1.1%' },
        { s: 'NVDA', p: 460.10, c: '+2.3%' },
        { s: 'BTC', p: 36500, c: '+3.4%' },
        { s: 'ETH', p: 1920, c: '+1.8%' },
        { s: 'AMZN', p: 128.40, c: '+0.4%' }
    ];

    let html = '';
    // Duplicamos los items muchas veces para garantizar que el scroll infinito no se corte en pantallas grandes
    const displaySymbols = [...symbols, ...symbols, ...symbols, ...symbols];

    displaySymbols.forEach(s => {
        const color = s.c.includes('+') ? 'text-emerald-400' : 'text-red-400';
        const icon = s.c.includes('+') ? 'north_east' : 'south_east';
        html += `
            <div class="flex items-center gap-3 px-8 border-r border-white/5 min-w-max">
                <span class="font-bold text-white text-sm">${s.s}</span>
                <span class="text-slate-400 text-sm font-mono">$${s.p}</span>
                <span class="${color} text-xs flex items-center font-bold bg-white/5 px-1.5 py-0.5 rounded">
                    <span class="material-symbols-outlined text-[10px] mr-1">${icon}</span>${s.c}
                </span>
            </div>
        `;
    });

    tickerContainer.innerHTML = html;
}

function animateValue(id, start, end, duration, suffix = "") {
    const obj = document.getElementById(id);
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Easing simple
        const easeProgress = 1 - Math.pow(1 - progress, 3); 
        
        const val = Math.floor(easeProgress * (end - start) + start);
        obj.innerHTML = val.toLocaleString('es-MX') + (suffix ? `<span class="text-primary text-2xl ml-1">${suffix}</span>` : "");
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}