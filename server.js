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

// --- DATOS ESTÁTICOS DE PORTAFOLIOS ---
const portfolios = [
    { id: 1, name: "Alpha Growth Fund", provider: "BlackRock Mexico", risk: "Alto", returnYTD: 99.99, users: 1240, minInvestment: 1000, description: "Enfoque agresivo en empresas tecnológicas y startups de LATAM." },
    { id: 2, name: "Estabilidad Total", provider: "BBVA Asset Mgmt", risk: "Bajo", returnYTD: 8.12, users: 5300, minInvestment: 500, description: "Bonos gubernamentales y deuda corporativa de alta calificación." },
    { id: 3, name: "Futuro Sostenible", provider: "Santander ESG", risk: "Medio", returnYTD: 14.50, users: 2100, minInvestment: 2000, description: "Inversión en empresas con certificaciones de energía limpia." },
    { id: 4, name: "Crypto Blue Chips", provider: "Bitso Alpha", risk: "Alto", returnYTD: 145.20, users: 890, minInvestment: 5000, description: "Canasta ponderada de Bitcoin y Ethereum." },
    { id: 5, name: "Bienes Raíces FIBRAs", provider: "Fibra Uno", risk: "Medio", returnYTD: 12.30, users: 3400, minInvestment: 100, description: "Inversión inmobiliaria comercial y rentas." },
    { id: 6, name: "Asian Tigers", provider: "HSBC Global", risk: "Alto", returnYTD: 18.40, users: 1100, minInvestment: 3000, description: "Mercados emergentes de Asia (Vietnam, India, Indonesia)." },
    { id: 7, name: "Deuda USA", provider: "Vanguard", risk: "Bajo", returnYTD: 4.50, users: 6000, minInvestment: 500, description: "Bonos del tesoro de Estados Unidos protegidos contra inflación." },
    { id: 8, name: "Gaming & eSports", provider: "VanEck", risk: "Alto", returnYTD: 32.10, users: 2200, minInvestment: 1500, description: "Empresas de videojuegos, hardware y torneos." },
    { id: 9, name: "Oro & Metales", provider: "Scotiabank", risk: "Medio", returnYTD: 9.80, users: 4100, minInvestment: 2000, description: "Resguardo de valor en metales preciosos físicos." }
];

// --- RUTAS API ---

// 1. Portafolios
app.get('/api/portfolios', (req, res) => res.json(portfolios));

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

// 5. DATOS DEL MERCADO (VERSIÓN TWELVE DATA)
app.get('/api/market', async (req, res) => {
    try {
        const symbol = 'AAPL'; // Apple
        const interval = '1day'; // Datos diarios
        const apikey = process.env.TWELVEDATA_API_KEY;
        
        // Si no hay llave configurada, forzamos error para usar simulación
        if (!apikey || apikey.includes('TU_LLAVE')) throw new Error("Falta API Key");

        const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&apikey=${apikey}&outputsize=30`;
        
        console.log(`📡 Consultando Twelve Data (${symbol})...`);
        const response = await axios.get(url);
        
        // Twelve Data devuelve un objeto con un array 'values'
        if (response.data.values) {
            console.log("✅ Datos recibidos de Twelve Data");
            
            // ADAPTADOR: Convertir formato Twelve Data al formato que usa tu gráfica
            // Twelve Data viene ordenado del más nuevo al más viejo, hay que invertirlo (.reverse)
            const rawData = response.data.values.reverse();
            
            const prices = rawData.map(item => parseFloat(item.close));
            const dates = rawData.map(item => {
                // Convertir fecha "2023-10-25" a timestamp Unix para que tu gráfica lo entienda
                return Math.floor(new Date(item.datetime).getTime() / 1000);
            });

            res.json({ prices, dates });
        } else {
            // Si la API responde con error (ej. límite excedido)
            console.error("⚠️ Error API:", response.data);
            throw new Error("Respuesta API inválida");
        }

    } catch (error) {
        console.error("❌ Falló la API Real:", error.message);
        console.log("⚠️ Usando respaldo simulado...");
        
        // FALLBACK (PLAN B) - Simulación
        const points = 30; 
        const prices = [];
        const dates = [];
        let currentPrice = 180; // Precio base Apple aprox
        
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

        if (investmentAmount <= 0 || parseFloat(user.balance) < investmentAmount) return res.status(400).json({ message: 'Saldo inválido' });

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
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
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
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
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
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
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