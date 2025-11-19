// 5. DATOS DEL MERCADO (Versión "Hardcode" para asegurar que funcione)
app.get('/api/market', async (req, res) => {
    try {
        // 1. PON TU LLAVE NUEVA AQUÍ DIRECTAMENTE (Entre comillas)
        const token = "PON_TU_LLAVE_NUEVA_AQUI_DENTRO"; 

        // 2. CAMBIAMOS A 'AAPL' (Apple) y usamos la API de 'quote' que es más simple para probar
        // Si esto funciona, luego regresamos a las velas (candles)
        // Pero primero usemos velas (candle) con AAPL
        const symbol = 'AAPL'; 
        const resolution = 'D';
        const to = Math.floor(Date.now() / 1000);
        const from = to - (30 * 24 * 60 * 60);

        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`;
        
        console.log(`Testing Finnhub Key directly...`);
        
        const response = await axios.get(url);
        
        if (response.data.s === 'ok') {
            res.json({
                prices: response.data.c,
                dates: response.data.t
            });
        } else {
            console.error("Finnhub Data Error:", response.data);
            // Si dice "no_data", es que la llave sirve pero no hay datos para esa fecha/acción
            throw new Error("API Error: " + response.data.s);
        }

    } catch (error) {
        console.error("❌ Error Finnhub Definitivo:", error.message);
        if (error.response) console.error("Status:", error.response.status);
        
        // Fallback Simulado
        console.log("⚠️ Activando Simulación.");
        const points = 30; 
        const prices = [];
        const dates = [];
        let currentPrice = 150; // Precio Apple aprox
        for (let i = 0; i < points; i++) {
            currentPrice = currentPrice * (1 + (Math.random() * 0.06 - 0.025));
            prices.push(currentPrice.toFixed(2));
            dates.push(Math.floor(Date.now() / 1000) - ((points - 1 - i) * 24 * 60 * 60));
        }
        res.json({ prices, dates });
    }
});