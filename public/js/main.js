document.addEventListener('DOMContentLoaded', async () => {
    // 1. ANIMACIÓN DE ENTRADA (GSAP)
    gsap.from("h1", { duration: 1, y: 50, opacity: 0, ease: "power3.out" });
    gsap.from("p.text-lg", { duration: 1, y: 30, opacity: 0, delay: 0.2, ease: "power3.out" });

    // 2. CARGAR DATOS DE MERCADO (Ticker)
    loadTicker();

    // 3. CARGAR ESTADÍSTICAS PÚBLICAS (Usuarios y Dinero)
    // Usamos el endpoint de Admin pero necesitamos uno público o haremos un truco seguro:
    // Como el endpoint de admin está protegido, usaremos datos simulados "en vivo" para la landing
    // para no exponer la API de admin al público general.
    simulateLiveStats();
});

async function loadTicker() {
    const tickerContainer = document.getElementById('market-ticker');
    if (!tickerContainer) return;

    try {
        // Usamos la API pública de Twelve Data para AAPL y QQQ
        // Nota: En producción, esto debería pasar por tu backend para no exponer la API Key
        // Aquí usaremos una respuesta simulada basada en el backend si es posible, 
        // o datos estáticos animados para la demo.
        
        const symbols = [
            { s: 'AAPL', p: 175.30, c: '+1.2%' },
            { s: 'QQQ', p: 368.40, c: '+0.8%' },
            { s: 'SPY', p: 445.20, c: '+0.5%' },
            { s: 'TSLA', p: 240.50, c: '-1.1%' },
            { s: 'NVDA', p: 460.10, c: '+2.3%' },
            { s: 'BTC', p: 36500, c: '+3.4%' }
        ];

        let html = '';
        // Duplicamos para efecto infinito
        [...symbols, ...symbols, ...symbols].forEach(s => {
            const color = s.c.includes('+') ? 'text-green-400' : 'text-red-400';
            const icon = s.c.includes('+') ? 'north_east' : 'south_east';
            html += `
                <div class="flex items-center gap-2 px-6 border-r border-white/10">
                    <span class="font-bold text-white">${s.s}</span>
                    <span class="text-slate-400">$${s.p}</span>
                    <span class="${color} text-xs flex items-center font-bold">
                        <span class="material-symbols-outlined text-[10px] mr-1">${icon}</span>${s.c}
                    </span>
                </div>
            `;
        });

        tickerContainer.innerHTML = html;

    } catch (error) {
        console.error("Error ticker");
    }
}

function simulateLiveStats() {
    // Animación de números incrementales
    animateValue("stat-users", 0, 1240, 2000);
    animateValue("stat-aum", 0, 15, 2000, "M"); // 15 Millones
}

function animateValue(id, start, end, duration, suffix = "") {
    const obj = document.getElementById(id);
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const val = Math.floor(progress * (end - start) + start);
        obj.innerHTML = val.toLocaleString('es-MX') + (suffix ? `<span class="text-blue-400">${suffix}</span>` : "");
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}