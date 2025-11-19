const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initDb, openDb } = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'mi_secreto_super_seguro'; 

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;
initDb().then(database => { db = database; });

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

app.get('/api/portfolios', (req, res) => res.json(portfolios));

// [NUEVO] Obtener Historial
app.get('/api/transactions', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        // Ordenar por fecha descendente (lo más nuevo primero)
        const history = await db.all('SELECT * FROM transactions WHERE userId = ? ORDER BY id DESC', [decoded.id]);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error obteniendo historial' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await db.get('SELECT id, email, balance FROM users WHERE id = ?', [decoded.id]);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        // Calcular inversiones
        const investmentsList = await db.all('SELECT amount FROM investments WHERE userId = ?', [user.id]);
        let totalInvested = 0;
        let totalCurrentValue = 0;
        investmentsList.forEach(inv => {
            totalInvested += inv.amount;
            totalCurrentValue += inv.amount * 1.015; // Simulación ganancia
        });

        res.json({ 
            email: user.email, 
            availableBalance: user.balance, 
            investedAmount: totalInvested,
            currentValue: totalCurrentValue,
            profit: totalCurrentValue - totalInvested,
            netWorth: user.balance + totalCurrentValue
        });
    } catch (error) { res.status(401).json({ message: 'Token inválido' }); }
});

app.get('/api/my-investments', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No autorizado' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userInvestments = await db.all('SELECT * FROM investments WHERE userId = ?', [decoded.id]);
        const enriched = userInvestments.map(inv => {
            const portfolio = portfolios.find(p => p.id === inv.portfolioId);
            const currentVal = inv.amount * 1.015;
            return {
                id: inv.id,
                portfolioName: portfolio ? portfolio.name : 'Fondo Desconocido',
                risk: portfolio ? portfolio.risk : 'N/A',
                investedAmount: inv.amount,
                currentValue: currentVal,
                profit: currentVal - inv.amount,
                date: inv.date
            };
        });
        res.json(enriched);
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// INVERTIR (Con registro en historial)
app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
        const investmentAmount = parseFloat(amount);
        const portfolio = portfolios.find(p => p.id === parseInt(portfolioId));

        if (investmentAmount <= 0 || user.balance < investmentAmount) return res.status(400).json({ message: 'Saldo inválido' });

        await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [investmentAmount, user.id]);
        await db.run('INSERT INTO investments (userId, portfolioId, amount, date) VALUES (?, ?, ?, ?)', [user.id, portfolioId, investmentAmount, new Date().toISOString()]);
        
        // [NUEVO] Guardar en Historial
        await db.run(
            'INSERT INTO transactions (userId, type, description, amount, date) VALUES (?, ?, ?, ?, ?)',
            [user.id, 'invest', `Inversión en ${portfolio.name}`, -investmentAmount, new Date().toISOString()]
        );

        const updatedUser = await db.get('SELECT balance FROM users WHERE id = ?', [user.id]);
        res.status(201).json({ message: 'Inversión exitosa', newBalance: updatedUser.balance });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
});

// DEPOSITAR (Con registro en historial)
app.post('/api/deposit', async (req, res) => {
    const { amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
        const depositAmount = parseFloat(amount);
        
        if (depositAmount <= 0) return res.status(400).json({ message: 'Monto inválido' });

        await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [depositAmount, user.id]);
        
        // [NUEVO] Guardar en Historial
        await db.run(
            'INSERT INTO transactions (userId, type, description, amount, date) VALUES (?, ?, ?, ?, ?)',
            [user.id, 'deposit', 'Depósito de Fondos', depositAmount, new Date().toISOString()]
        );

        const updatedUser = await db.get('SELECT balance FROM users WHERE id = ?', [user.id]);
        res.status(201).json({ message: 'Depósito exitoso', newBalance: updatedUser.balance });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
});

// RETIRAR (Con registro en historial)
app.post('/api/withdraw', async (req, res) => {
    const { amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
        const withdrawAmount = parseFloat(amount);

        if (withdrawAmount <= 0 || user.balance < withdrawAmount) return res.status(400).json({ message: 'Fondos insuficientes' });

        await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [withdrawAmount, user.id]);
        
        // [NUEVO] Guardar en Historial
        await db.run(
            'INSERT INTO transactions (userId, type, description, amount, date) VALUES (?, ?, ?, ?, ?)',
            [user.id, 'withdraw', 'Retiro a Cuenta Bancaria', -withdrawAmount, new Date().toISOString()]
        );

        const updatedUser = await db.get('SELECT balance FROM users WHERE id = ?', [user.id]);
        res.status(201).json({ message: 'Retiro exitoso', newBalance: updatedUser.balance });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
});

// VENDER (Con registro en historial)
app.post('/api/sell', async (req, res) => {
    const { investmentId, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const investment = await db.get('SELECT * FROM investments WHERE id = ? AND userId = ?', [investmentId, decoded.id]);
        if (!investment) return res.status(404).json({ message: 'Inversión no encontrada' });

        const portfolio = portfolios.find(p => p.id === investment.portfolioId);
        const finalAmount = investment.amount * 1.015; // Simulación

        await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [finalAmount, decoded.id]);
        await db.run('DELETE FROM investments WHERE id = ?', [investmentId]);

        // [NUEVO] Guardar en Historial
        await db.run(
            'INSERT INTO transactions (userId, type, description, amount, date) VALUES (?, ?, ?, ?, ?)',
            [decoded.id, 'sell', `Venta ${portfolio ? portfolio.name : 'Fondo'}`, finalAmount, new Date().toISOString()]
        );

        const updatedUser = await db.get('SELECT balance FROM users WHERE id = ?', [decoded.id]);
        res.status(200).json({ message: 'Venta exitosa', newBalance: updatedUser.balance });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
});

// AUTH
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) return res.status(400).json({ message: 'Usuario existe' });
        const hashed = await bcrypt.hash(password, 10);
        
        // Registrar usuario y su primera transacción (Bono)
        const result = await db.run('INSERT INTO users (email, password, balance) VALUES (?, ?, ?)', [email, hashed, 50000]);
        
        // [NUEVO] Historial del bono
        await db.run(
            'INSERT INTO transactions (userId, type, description, amount, date) VALUES (?, ?, ?, ?, ?)',
            [result.lastID, 'deposit', 'Bono de Bienvenida', 50000, new Date().toISOString()]
        );

        res.status(201).json({ message: 'Creado' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: 'Credenciales inválidas' });
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, message: 'Login exitoso' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });