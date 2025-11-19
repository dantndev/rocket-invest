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

// --- DATOS DE FONDOS COLECTIVOS ---
// targetAmount: Meta de dinero a recaudar
// currentAmount: Dinero ya recaudado
// investors: Número de socios actuales
const portfolios = [
    { 
        id: 1, 
        name: "Alpha Tech Giants", 
        provider: "BlackRock", 
        ticker: "QQQ", 
        risk: "Alto", 
        returnYTD: 99.99, 
        targetAmount: 10000000, // 10 Millones
        currentAmount: 7540000, 
        investors: 342,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "12 Meses",
        description: "Acceso grupal a las 100 tecnológicas más grandes. Faltan socios para cerrar el grupo." 
    },
    { 
        id: 2, 
        name: "Deuda Soberana Plus", 
        provider: "Santander", 
        ticker: "SHV", 
        risk: "Bajo", 
        returnYTD: 8.12, 
        targetAmount: 5000000,
        currentAmount: 4800000, 
        investors: 890,
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
        targetAmount: 15000000,
        currentAmount: 3200000, 
        investors: 150,
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
        targetAmount: 8000000,
        currentAmount: 1200000,
        investors: 80,
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
        targetAmount: 20000000,
        currentAmount: 15000000,
        investors: 1400,
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
        targetAmount: 5000000,
        currentAmount: 500000,
        investors: 40,
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
        targetAmount: 10000000,
        currentAmount: 9000000,
        investors: 2000,
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
        targetAmount: 3000000,
        currentAmount: 2800000,
        investors: 900,
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
        targetAmount: 50000000,
        currentAmount: 41000000,
        investors: 3100,
        minInvestment: 1000,
        status: "open",
        lockUpPeriod: "Indefinido",
        description: "Resguardo de valor respaldado en lingotes reales." 
    }
];

// --- RUTAS API ---

// 1. Portafolios (Con conteo real desde Base de Datos)
app.get('/api/portfolios', async (req, res) => {
    try {
        // Hacemos una copia de los portafolios base para no modificar el original permanentemente en memoria
        // Usamos map para crear objetos nuevos
        const livePortfolios = await Promise.all(portfolios.map(async (p) => {
            // 1. Contar cuánto dinero real han metido los usuarios a este fondo
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);

            // 2. Contar cuántos socios reales hay (usuarios únicos)
            const countRes = await query('SELECT COUNT(DISTINCT userId) as sociocount FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].sociocount || 0);

            return {
                ...p, // Copiamos nombre, ticker, riesgo...
                // SUMAMOS: Lo que ya tenía el fondo (Base) + Lo que han invertido tus usuarios (Real)
                currentAmount: p.currentAmount + realMoney, 
                investors: p.investors + realInvestors
            };
        }));

        res.json(livePortfolios);
    } catch (error) {
        console.error(error);
        // Si falla la BD, devolvemos los estáticos
        res.json(portfolios);
    }
});

app.get('/api/transactions', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const result = await query('SELECT * FROM transactions WHERE userId = $1 ORDER BY id DESC', [decoded.id]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: 'Error historial' }); }
});

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
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// 5. DATOS DEL MERCADO (TWELVE DATA)
app.get('/api/market', async (req, res) => {
    try {
        const symbol = 'AAPL'; 
        const interval = '1day'; 
        const apikey = process.env.TWELVEDATA_API_KEY; 

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
        console.error("❌ Falló API Real:", error.message);
        console.log("⚠️ Usando simulación...");
        // Fallback
        const points = 30; const prices = []; const dates = []; let currentPrice = 180; 
        for (let i = 0; i < points; i++) {
            currentPrice = currentPrice * (1 + (Math.random() * 0.06 - 0.025));
            prices.push(currentPrice.toFixed(2));
            dates.push(Math.floor(Date.now() / 1000) - ((points - 1 - i) * 24 * 60 * 60));
        }
        res.json({ prices, dates });
    }
});

// --- LÓGICA DE INVERSIÓN MEJORADA ---
app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        const investmentAmount = parseFloat(amount);
        
        // 1. VALIDACIÓN: Monto mínimo y múltiplos de 1000
        if (investmentAmount < 1000 || investmentAmount % 1000 !== 0) {
            return res.status(400).json({ message: 'La inversión debe ser en bloques de $1,000 MXN.' });
        }

        // 2. VALIDACIÓN: Saldo suficiente
        if (user.balance < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente.' });

        // 3. VALIDACIÓN: Solo una vez por fondo
        const existingInv = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, portfolioId]);
        if (existingInv.rows.length > 0) {
            return res.status(400).json({ message: 'Ya eres socio de este fondo. Solo se permite una participación.' });
        }

        // 4. Ejecutar Transacción
        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', 
            [user.id, portfolioId, investmentAmount, new Date().toISOString()]);
        
        // Recuperar nombre para historial
        const portfolio = portfolios.find(p => p.id === parseInt(portfolioId));
        
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [user.id, 'invest', `Entrada al fondo ${portfolio ? portfolio.name : 'ID ' + portfolioId}`, -investmentAmount, new Date().toISOString()]);

        // 5. Actualizar Contadores de Grupo (En memoria)
        if (portfolio) {
            portfolio.currentAmount += investmentAmount;
            portfolio.investors += 1;
        }

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: '¡Bienvenido al grupo! Inversión exitosa.', newBalance: parseFloat(updatedUserRes.rows[0].balance) });

    } catch (error) { console.error(error); res.status(500).json({ message: 'Error procesando inversión' }); }
});

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
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [decoded.id, 'sell', `Salida del grupo ${portfolio ? portfolio.name : 'Fondo'}`, finalAmount, new Date().toISOString()]);
        
        // Ajuste en memoria (Restar al grupo)
        if (portfolio) {
            portfolio.currentAmount -= amount;
            portfolio.investors -= 1;
        }

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [decoded.id]);
        res.status(200).json({ message: 'Venta exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

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