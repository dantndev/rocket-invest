require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
const { initDb, query } = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'mi_secreto_super_seguro';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar Base de Datos
initDb();

// --- DATOS BASE DE LOS FONDOS ---
// baseInvestors: Número inicial simulado (Lo puse en 0 para que veas el cambio real)
// baseAmount: Dinero inicial simulado
const portfolios = [
    { 
        id: 1, 
        name: "Alpha Tech Giants", 
        provider: "BlackRock", 
        ticker: "QQQ", 
        risk: "Alto", 
        returnYTD: 99.99, 
        targetInvestors: 5000, 
        baseInvestors: 0,       // <--- INICIA EN 0
        baseAmount: 0,          // <--- INICIA EN 0
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "12 Meses",
        description: "Acceso grupal a las 100 tecnológicas más grandes. Sé de los primeros socios." 
    },
    { 
        id: 2, 
        name: "Deuda Soberana Plus", 
        provider: "Santander", 
        ticker: "SHV", 
        risk: "Bajo", 
        returnYTD: 8.12, 
        targetInvestors: 10000,
        baseInvestors: 0,       // <--- INICIA EN 0
        baseAmount: 0,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "3 Meses",
        description: "Bonos de gobierno con tasa preferencial por volumen de capital." 
    },
    { 
        id: 3, 
        name: "Energía Limpia Global", 
        provider: "iShares", 
        ticker: "ICLN", 
        risk: "Medio", 
        returnYTD: 14.50, 
        targetInvestors: 2000,
        baseInvestors: 120,     // Este sí tiene gente para que se vea diferente
        baseAmount: 2500000,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "24 Meses",
        description: "Únete al grupo de inversión en infraestructura renovable." 
    },
    { 
        id: 4, 
        name: "Crypto Proxies", 
        provider: "ProShares", 
        ticker: "BITO", 
        risk: "Alto", 
        returnYTD: 145.20, 
        targetInvestors: 1000,
        baseInvestors: 0,
        baseAmount: 0,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "6 Meses",
        description: "Exposición a futuros de Bitcoin sin custodia directa." 
    },
    { 
        id: 5, 
        name: "Bienes Raíces FIBRAs", 
        provider: "Fibra Uno", 
        ticker: "VNQ", 
        risk: "Medio", 
        returnYTD: 12.30, 
        targetInvestors: 5000,
        baseInvestors: 1400,
        baseAmount: 15000000,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "12 Meses",
        description: "Portafolio de rentas comerciales diversificadas." 
    },
    { 
        id: 6, 
        name: "Asian Tigers", 
        provider: "HSBC Global", 
        ticker: "VWO", 
        risk: "Alto", 
        returnYTD: 18.40, 
        targetInvestors: 2000,
        baseInvestors: 40,
        baseAmount: 500000,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "18 Meses",
        description: "Mercados emergentes de alto crecimiento en Asia." 
    },
    { 
        id: 7, 
        name: "Deuda Corporativa USA", 
        provider: "Vanguard", 
        ticker: "LQD", 
        risk: "Bajo", 
        returnYTD: 4.50, 
        targetInvestors: 8000,
        baseInvestors: 2000,
        baseAmount: 9000000,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "6 Meses",
        description: "Bonos corporativos de grado inversión en dólares." 
    },
    { 
        id: 8, 
        name: "Gaming & eSports", 
        provider: "VanEck", 
        ticker: "ESPO", 
        risk: "Alto", 
        returnYTD: 32.10, 
        targetInvestors: 3000,
        baseInvestors: 900,
        baseAmount: 2800000,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "12 Meses",
        description: "El futuro del entretenimiento digital." 
    },
    { 
        id: 9, 
        name: "Oro Físico", 
        provider: "SPDR", 
        ticker: "GLD", 
        risk: "Medio", 
        returnYTD: 9.80, 
        targetInvestors: 6000,
        baseInvestors: 3100,
        baseAmount: 41000000,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "Indefinido",
        description: "Resguardo de valor respaldado en lingotes reales." 
    }
];

// --- RUTAS API ---

// 1. Portafolios (LÓGICA DE CONTEO REAL)
app.get('/api/portfolios', async (req, res) => {
    try {
        // Recorremos los portafolios y consultamos la BD para cada uno
        const livePortfolios = await Promise.all(portfolios.map(async (p) => {
            
            // 1. Contar dinero real invertido en este fondo
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);

            // 2. Contar socios reales (usuarios únicos)
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].count || 0);

            return {
                ...p, 
                // Sumamos la base (0) + lo real de la BD
                currentAmount: p.baseAmount + realMoney, 
                currentInvestors: p.baseInvestors + realInvestors,
                investors: p.baseInvestors + realInvestors // Alias para compatibilidad
            };
        }));

        res.json(livePortfolios);
    } catch (error) {
        console.error("Error calculando portafolios:", error);
        // Si falla la BD, mostramos los estáticos
        res.json(portfolios.map(p => ({
            ...p, 
            currentAmount: p.baseAmount, 
            currentInvestors: p.baseInvestors,
            investors: p.baseInvestors
        })));
    }
});

// 2. Historial
app.get('/api/transactions', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const result = await query('SELECT * FROM transactions WHERE userId = $1 ORDER BY id DESC', [decoded.id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error obteniendo historial' });
    }
});

// 3. Datos Usuario
app.get('/api/auth/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT id, email, balance FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        const invRes = await query('SELECT amount FROM investments WHERE userId = $1', [user.id]);
        let totalInvested = 0;
        let totalCurrentValue = 0;
        
        invRes.rows.forEach(inv => {
            const amount = parseFloat(inv.amount);
            totalInvested += amount;
            totalCurrentValue += amount * 1.015; 
        });

        res.json({ 
            email: user.email, 
            availableBalance: parseFloat(user.balance), 
            investedAmount: totalInvested,
            currentValue: totalCurrentValue,
            profit: totalCurrentValue - totalInvested,
            netWorth: parseFloat(user.balance) + totalCurrentValue
        });
    } catch (error) { res.status(401).json({ message: 'Token inválido' }); }
});

// 4. Mis Inversiones
app.get('/api/my-investments', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No autorizado' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const result = await query('SELECT * FROM investments WHERE userId = $1', [decoded.id]);
        
        const enriched = result.rows.map(inv => {
            const amount = parseFloat(inv.amount);
            const portfolio = portfolios.find(p => p.id === inv.portfolioid);
            const currentVal = amount * 1.015;
            return {
                id: inv.id,
                portfolioName: portfolio ? portfolio.name : 'Fondo Desconocido',
                risk: portfolio ? portfolio.risk : 'N/A',
                investedAmount: amount,
                currentValue: currentVal,
                profit: currentVal - amount,
                date: inv.date
            };
        });
        res.json(enriched);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
});

// 5. DATOS DEL MERCADO (TWELVE DATA)
app.get('/api/market', async (req, res) => {
    try {
        const symbol = 'AAPL'; 
        const interval = '1day'; 
        const apikey = process.env.TWELVEDATA_API_KEY;
        
        if (!apikey || apikey.includes('TU_LLAVE')) throw new Error("Falta API Key");

        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&apikey=${apikey}&outputsize=30`;
        
        console.log(`📡 Consultando Twelve Data...`);
        const response = await axios.get(url);
        
        if (response.data.values) {
            const rawData = response.data.values.reverse();
            const prices = rawData.map(item => parseFloat(item.close));
            const dates = rawData.map(item => Math.floor(new Date(item.datetime).getTime() / 1000));
            res.json({ prices, dates });
        } else {
            throw new Error("Respuesta API inválida");
        }
    } catch (error) {
        console.log("⚠️ Usando simulación de mercado.");
        const points = 30; const prices = []; const dates = []; let currentPrice = 180; 
        for (let i = 0; i < points; i++) {
            currentPrice = currentPrice * (1 + (Math.random() * 0.06 - 0.025));
            prices.push(currentPrice.toFixed(2));
            dates.push(Math.floor(Date.now() / 1000) - ((points - 1 - i) * 24 * 60 * 60));
        }
        res.json({ prices, dates });
    }
});

// 6. Invertir
app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        const investmentAmount = parseFloat(amount);
        const portfolio = portfolios.find(p => p.id === parseInt(portfolioId));

        // Validaciones
        if (investmentAmount < 1000 || investmentAmount % 1000 !== 0) return res.status(400).json({ message: 'Monto inválido (Múltiplos de 1000)' });
        if (user.balance < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente' });

        const existing = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, portfolioId]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya eres socio de este fondo.' });

        // Ejecutar Transacción
        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', [user.id, portfolioId, investmentAmount, new Date().toISOString()]);
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [user.id, 'invest', `Inversión en ${portfolio.name}`, -investmentAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: 'Inversión exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
});

// 7. Depositar
app.post('/api/deposit', async (req, res) => {
    const { amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];

        const depositAmount = parseFloat(amount);
        if (depositAmount <= 0) return res.status(400).json({ message: 'Monto inválido' });

        await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [depositAmount, user.id]);
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [user.id, 'deposit', 'Depósito de Fondos', depositAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: 'Depósito exitoso', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// 8. Retirar
app.post('/api/withdraw', async (req, res) => {
    const { amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        const withdrawAmount = parseFloat(amount);

        if (withdrawAmount <= 0 || parseFloat(user.balance) < withdrawAmount) return res.status(400).json({ message: 'Fondos insuficientes' });

        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [withdrawAmount, user.id]);
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [user.id, 'withdraw', 'Retiro a Cuenta Bancaria', -withdrawAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: 'Retiro exitoso', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// 9. Vender
app.post('/api/sell', async (req, res) => {
    const { investmentId, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const invRes = await query('SELECT * FROM investments WHERE id = $1 AND userId = $2', [investmentId, decoded.id]);
        if (invRes.rows.length === 0) return res.status(404).json({ message: 'Inversión no encontrada' });
        
        const investment = invRes.rows[0];
        const portfolio = portfolios.find(p => p.id === investment.portfolioid); 
        const amount = parseFloat(investment.amount);
        const finalAmount = amount * 1.015; 

        await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [finalAmount, decoded.id]);
        await query('DELETE FROM investments WHERE id = $1', [investmentId]);
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [decoded.id, 'sell', `Venta ${portfolio ? portfolio.name : 'Fondo'}`, finalAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [decoded.id]);
        res.status(200).json({ message: 'Venta exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// 10. Registro
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const existingRes = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingRes.rows.length > 0) return res.status(400).json({ message: 'Usuario existe' });

        const hashed = await bcrypt.hash(password, 10);
        const result = await query('INSERT INTO users (email, password, balance) VALUES ($1, $2, $3) RETURNING id', [email, hashed, 50000]);
        const newUserId = result.rows[0].id;

        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [newUserId, 'deposit', 'Bono de Bienvenida', 50000, new Date().toISOString()]);

        res.status(201).json({ message: 'Creado' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
});

// 11. Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userRes.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: 'Credenciales inválidas' });
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, message: 'Login exitoso' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error' }); }
});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });