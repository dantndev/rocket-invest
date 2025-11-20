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

initDb();

// --- DATOS BASE (CROWDFUNDING DE DINERO) ---
const portfoliosBase = [
    { 
        id: 1, 
        name: "Alpha Tech Giants", 
        provider: "BlackRock", 
        ticker: "QQQ", 
        risk: "Alto", 
        returnYTD: 99.99, 
        targetAmount: 10000000, // Meta: $10M
        baseAmount: 7545000,    // Base inicial simulada
        baseInvestors: 342,     // Socios iniciales
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "12 Meses",
        description: "Acceso grupal a las 100 tecnológicas más grandes." 
    },
    { 
        id: 2, 
        name: "Deuda Soberana Plus", 
        provider: "Santander", 
        ticker: "SHV", 
        risk: "Bajo", 
        returnYTD: 8.12, 
        targetAmount: 5000000,
        baseAmount: 4800000,   
        baseInvestors: 890,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "3 Meses",
        description: "Bonos de gobierno con tasa preferencial." 
    },
    { 
        id: 3, 
        name: "Energía Limpia Global", 
        provider: "iShares", 
        ticker: "ICLN", 
        risk: "Medio", 
        returnYTD: 14.50, 
        targetAmount: 2000000,
        baseAmount: 150000,    
        baseInvestors: 45,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "24 Meses",
        description: "Infraestructura renovable global." 
    },
    { 
        id: 4, 
        name: "Crypto Proxies", 
        provider: "ProShares", 
        ticker: "BITO", 
        risk: "Alto", 
        returnYTD: 145.20, 
        targetAmount: 8000000,
        baseAmount: 1200000,
        baseInvestors: 80,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "6 Meses",
        description: "Exposición a futuros de Bitcoin." 
    },
    { 
        id: 5, 
        name: "Bienes Raíces FIBRAs", 
        provider: "Fibra Uno", 
        ticker: "VNQ", 
        risk: "Medio", 
        returnYTD: 12.30, 
        targetAmount: 20000000,
        baseAmount: 15000000,
        baseInvestors: 1400,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "12 Meses",
        description: "Rentas comerciales diversificadas." 
    },
    { 
        id: 6, 
        name: "Asian Tigers", 
        provider: "HSBC Global", 
        ticker: "VWO", 
        risk: "Alto", 
        returnYTD: 18.40, 
        targetAmount: 5000000,
        baseAmount: 500000,
        baseInvestors: 40,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "18 Meses",
        description: "Mercados emergentes de Asia." 
    },
    { 
        id: 7, 
        name: "Deuda Corporativa USA", 
        provider: "Vanguard", 
        ticker: "LQD", 
        risk: "Bajo", 
        returnYTD: 4.50, 
        targetAmount: 10000000,
        baseAmount: 9000000,
        baseInvestors: 2000,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "6 Meses",
        description: "Bonos corporativos grado inversión." 
    },
    { 
        id: 8, 
        name: "Gaming & eSports", 
        provider: "VanEck", 
        ticker: "ESPO", 
        risk: "Alto", 
        returnYTD: 32.10, 
        targetAmount: 3000000,
        baseAmount: 2800000,
        baseInvestors: 900,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "12 Meses",
        description: "Entretenimiento digital." 
    },
    { 
        id: 9, 
        name: "Oro Físico", 
        provider: "SPDR", 
        ticker: "GLD", 
        risk: "Medio", 
        returnYTD: 9.80, 
        targetAmount: 50000000,
        baseAmount: 41000000,
        baseInvestors: 3100,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "Indefinido",
        description: "Resguardo en lingotes reales." 
    }
];

// --- RUTAS API ---

// 1. Portafolios Dinámicos (Suma Base + Real)
app.get('/api/portfolios', async (req, res) => {
    try {
        const livePortfolios = await Promise.all(portfoliosBase.map(async (p) => {
            // Dinero real invertido
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);
            
            // Inversores reales (únicos)
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].count || 0);

            return {
                ...p,
                currentAmount: p.baseAmount + realMoney,
                investors: p.baseInvestors + realInvestors
            };
        }));
        res.json(livePortfolios);
    } catch (error) {
        console.error(error);
        // Fallback seguro
        res.json(portfoliosBase.map(p => ({...p, currentAmount: p.baseAmount, investors: p.baseInvestors})));
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
    } catch (error) { res.status(500).json({ message: 'Error historial' }); }
});

// 3. Datos Usuario
app.get('/api/auth/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
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
            const portfolio = portfoliosBase.find(p => p.id === inv.portfolioid);
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
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// 5. Mercado
app.get('/api/market', async (req, res) => {
    try {
        const symbol = 'AAPL'; 
        const interval = '1day'; 
        const apikey = process.env.TWELVEDATA_API_KEY;
        
        // Si no hay API key, salta al catch para usar simulación
        if (!apikey || apikey.includes('TU_LLAVE')) throw new Error("Falta API Key");

        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&apikey=${apikey}&outputsize=30`;
        const response = await axios.get(url);
        
        if (response.data.values) {
            const rawData = response.data.values.reverse();
            const prices = rawData.map(item => parseFloat(item.close));
            const dates = rawData.map(item => Math.floor(new Date(item.datetime).getTime() / 1000));
            res.json({ prices, dates });
        } else { throw new Error("API Error"); }
    } catch (error) {
        // Fallback Simulado
        const points = 30; const prices = []; const dates = []; let currentPrice = 180; 
        for (let i = 0; i < points; i++) {
            currentPrice = currentPrice * (1 + (Math.random() * 0.06 - 0.025));
            prices.push(currentPrice.toFixed(2));
            dates.push(Math.floor(Date.now() / 1000) - ((points - 1 - i) * 24 * 60 * 60));
        }
        res.json({ prices, dates });
    }
});

// 6. Invertir (Lógica Cupos)
app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        const investmentAmount = parseFloat(amount);
        const portfolio = portfoliosBase.find(p => p.id === parseInt(portfolioId));

        if (investmentAmount < 1000 || investmentAmount % 1000 !== 0) return res.status(400).json({ message: 'Monto inválido (Múltiplos de 1000)' });
        if (user.balance < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente' });

        // Validar si ya es socio
        const existing = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, portfolioId]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya eres socio de este fondo.' });

        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', [user.id, portfolioId, investmentAmount, new Date().toISOString()]);
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [user.id, 'invest', `Entrada a grupo ${portfolio.name}`, -investmentAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: 'Inversión exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error procesando inversión' }); }
});

// 7. Deposit / 8. Withdraw / 9. Sell / 10. Register / 11. Login
// (Estos siguen igual, los simplifico para no hacer el mensaje eterno, pero asegúrate de tenerlos)
app.post('/api/deposit', async (req, res) => { /* ... código anterior ... */ 
    const { amount, token } = req.body;
    const decoded = jwt.verify(token, SECRET_KEY);
    const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = userRes.rows[0];
    const depositAmount = parseFloat(amount);
    await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [depositAmount, user.id]);
    await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [user.id, 'deposit', 'Depósito de Fondos', depositAmount, new Date().toISOString()]);
    const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
    res.status(201).json({ message: 'Depósito exitoso', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
});

app.post('/api/withdraw', async (req, res) => { /* ... código anterior ... */ 
    const { amount, token } = req.body;
    const decoded = jwt.verify(token, SECRET_KEY);
    const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = userRes.rows[0];
    const withdrawAmount = parseFloat(amount);
    if (user.balance < withdrawAmount) return res.status(400).json({ message: 'Fondos insuficientes' });
    await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [withdrawAmount, user.id]);
    await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [user.id, 'withdraw', 'Retiro', -withdrawAmount, new Date().toISOString()]);
    const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
    res.status(201).json({ message: 'Retiro exitoso', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
});

app.post('/api/sell', async (req, res) => { /* ... código anterior ... */ 
    const { investmentId, token } = req.body;
    const decoded = jwt.verify(token, SECRET_KEY);
    const invRes = await query('SELECT * FROM investments WHERE id = $1', [investmentId]);
    const investment = invRes.rows[0];
    const amount = parseFloat(investment.amount);
    const finalAmount = amount * 1.015;
    await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [finalAmount, decoded.id]);
    await query('DELETE FROM investments WHERE id = $1', [investmentId]);
    await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [decoded.id, 'sell', `Salida Grupo`, finalAmount, new Date().toISOString()]);
    const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [decoded.id]);
    res.status(200).json({ message: 'Venta exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
});

app.post('/api/auth/register', async (req, res) => { /* ... código anterior ... */ 
    const { email, password } = req.body;
    const existingRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingRes.rows.length > 0) return res.status(400).json({ message: 'Usuario existe' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await query('INSERT INTO users (email, password, balance) VALUES ($1, $2, $3) RETURNING id', [email, hashed, 50000]);
    await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [result.rows[0].id, 'deposit', 'Bono', 50000, new Date().toISOString()]);
    res.status(201).json({ message: 'Creado' });
});

app.post('/api/auth/login', async (req, res) => { /* ... código anterior ... */
    const { email, password } = req.body;
    const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(400).json({ message: 'Credenciales inválidas' });
    if (!(await bcrypt.compare(password, userRes.rows[0].password))) return res.status(400).json({ message: 'Credenciales inválidas' });
    const token = jwt.sign({ id: userRes.rows[0].id, email: userRes.rows[0].email }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, message: 'Login exitoso' });
});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });