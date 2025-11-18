const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initDb, openDb } = require('./db'); 

const app = express();
// Usar puerto de la nube o 3000
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'mi_secreto_super_seguro'; 

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;
initDb().then(database => {
    db = database;
});

// --- DATOS DE PORTAFOLIOS (9 Opciones) ---
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

app.get('/api/portfolios', (req, res) => {
    res.json(portfolios);
});

// 2. Obtener Datos Completos del Usuario (Perfil, Saldo, Inversiones calculadas)
app.get('/api/auth/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        // 1. Obtener Usuario (Saldo Disponible)
        const user = await db.get('SELECT id, email, balance FROM users WHERE id = ?', [decoded.id]);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        // 2. Obtener Inversiones Activas
        const investmentsList = await db.all('SELECT amount FROM investments WHERE userId = ?', [user.id]);

        // 3. Calcular Totales
        let totalInvested = 0;
        let totalCurrentValue = 0;

        investmentsList.forEach(inv => {
            totalInvested += inv.amount;
            // Simulamos la misma ganancia del 1.5% que usamos en la otra pantalla
            // En un app real, aquí consultaríamos el precio actual de la acción
            totalCurrentValue += inv.amount * 1.015; 
        });

        const totalProfit = totalCurrentValue - totalInvested;
        const netWorth = user.balance + totalCurrentValue; // Efectivo + Inversiones

        // 4. Enviar todo desglosado
        res.json({ 
            email: user.email, 
            availableBalance: user.balance, // Efectivo
            investedAmount: totalInvested,  // Costo inicial
            currentValue: totalCurrentValue, // Valor hoy
            profit: totalProfit,            // Ganancia neta
            netWorth: netWorth              // Patrimonio Total
        });

    } catch (error) {
        console.error(error);
        res.status(401).json({ message: 'Token inválido' });
    }
});

app.get('/api/my-investments', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No autorizado' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userInvestments = await db.all('SELECT * FROM investments WHERE userId = ?', [decoded.id]);

        const enrichedInvestments = userInvestments.map(inv => {
            const portfolio = portfolios.find(p => p.id === inv.portfolioId);
            const fakeProfitPercent = 0.015; 
            const currentValue = inv.amount * (1 + fakeProfitPercent);
            const profit = currentValue - inv.amount;

            return {
                id: inv.id,
                portfolioName: portfolio ? portfolio.name : 'Fondo Desconocido',
                risk: portfolio ? portfolio.risk : 'N/A',
                investedAmount: inv.amount,
                currentValue: currentValue,
                profit: profit,
                date: inv.date
            };
        });
        res.json(enrichedInvestments);
    } catch (error) {
        res.status(401).json({ message: 'Error al obtener inversiones' });
    }
});

app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
        
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        const investmentAmount = parseFloat(amount);

        if (investmentAmount <= 0) return res.status(400).json({ message: 'Monto inválido' });
        if (user.balance < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente' });

        await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [investmentAmount, user.id]);
        await db.run(
            'INSERT INTO investments (userId, portfolioId, amount, date) VALUES (?, ?, ?, ?)',
            [user.id, portfolioId, investmentAmount, new Date().toISOString()]
        );
        const updatedUser = await db.get('SELECT balance FROM users WHERE id = ?', [user.id]);

        res.status(201).json({ message: 'Inversión exitosa', newBalance: updatedUser.balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error procesando inversión' });
    }
});

app.post('/api/deposit', async (req, res) => {
    const { amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        const depositAmount = parseFloat(amount);
        if (depositAmount <= 0) return res.status(400).json({ message: 'Monto inválido' });

        await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [depositAmount, user.id]);
        const updatedUser = await db.get('SELECT balance FROM users WHERE id = ?', [user.id]);

        res.status(201).json({ message: 'Depósito exitoso', newBalance: updatedUser.balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error procesando el pago' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) return res.status(400).json({ message: 'El usuario ya existe' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run('INSERT INTO users (email, password, balance) VALUES (?, ?, ?)', [email, hashedPassword, 50000]);
        res.status(201).json({ message: 'Usuario creado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registrando usuario' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, message: 'Login exitoso' });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});