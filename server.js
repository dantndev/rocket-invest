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
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

initDb();

// --- DATOS BASE (RESETEADOS A 0) ---
const portfoliosBase = [
    { id: 1, name: "Alpha Tech Giants", provider: "BlackRock", ticker: "QQQ", risk: "Alto", returnYTD: 99.99, targetAmount: 10000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "12 Meses", description: "Acceso grupal a las 100 tecnológicas más grandes." },
    { id: 2, name: "Deuda Soberana Plus", provider: "Santander", ticker: "SHV", risk: "Bajo", returnYTD: 8.12, targetAmount: 5000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "3 Meses", description: "Bonos de gobierno con tasa preferencial." },
    { id: 3, name: "Energía Limpia Global", provider: "iShares", ticker: "ICLN", risk: "Medio", returnYTD: 14.50, targetAmount: 2000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "24 Meses", description: "Infraestructura renovable global." },
    { id: 4, name: "Crypto Proxies", provider: "ProShares", ticker: "BITO", risk: "Alto", returnYTD: 145.20, targetAmount: 8000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "6 Meses", description: "Exposición a futuros de Bitcoin." },
    { id: 5, name: "Bienes Raíces FIBRAs", provider: "Fibra Uno", ticker: "VNQ", risk: "Medio", returnYTD: 12.30, targetAmount: 20000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "12 Meses", description: "Rentas comerciales diversificadas." },
    { id: 6, name: "Asian Tigers", provider: "HSBC Global", ticker: "VWO", risk: "Alto", returnYTD: 18.40, targetAmount: 5000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "18 Meses", description: "Mercados emergentes de Asia." },
    { id: 7, name: "Deuda Corporativa USA", provider: "Vanguard", ticker: "LQD", risk: "Bajo", returnYTD: 4.50, targetAmount: 10000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "6 Meses", description: "Bonos corporativos grado inversión." },
    { id: 8, name: "Gaming & eSports", provider: "VanEck", ticker: "ESPO", risk: "Alto", returnYTD: 32.10, targetAmount: 3000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "12 Meses", description: "Entretenimiento digital." },
    { id: 9, name: "Oro Físico", provider: "SPDR", ticker: "GLD", risk: "Medio", returnYTD: 9.80, targetAmount: 50000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, status: "open", lockUpPeriod: "Indefinido", description: "Resguardo en lingotes reales." }
];

// --- RUTAS API ---

// GRÁFICA DUAL (PATRIMONIO Y RENDIMIENTO)
app.get('/api/chart-data', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const txRes = await query('SELECT * FROM transactions WHERE userId = $1 ORDER BY id ASC', [decoded.id]);
        
        const dates = [];
        const netWorthData = [];
        const profitData = [];
        
        let currentCash = 0;
        let currentInvested = 0;
        let netDeposits = 0; // Dinero metido de tu bolsillo

        txRes.rows.forEach(tx => {
            const amount = parseFloat(tx.amount);
            
            if (tx.type === 'deposit') {
                currentCash += amount;
                netDeposits += amount; // Dinero nuevo entra
            } else if (tx.type === 'withdraw') {
                currentCash += amount; // amount es negativo
                netDeposits += amount; // Dinero sale
            } else if (tx.type === 'invest') {
                currentCash += amount; // Resta de cash
                currentInvested += Math.abs(amount); // Suma a activos
            } else if (tx.type === 'sell') {
                currentCash += amount; // Entra cash (capital + ganancia)
                // Estimamos salida de activo (reversa de ganancia 1.5%)
                const costBasis = amount / 1.015; 
                currentInvested -= costBasis;
            }

            const totalAssets = currentCash + currentInvested;
            const totalProfit = totalAssets - netDeposits; // Lo que tienes MENOS lo que metiste = Ganancia real

            dates.push(Math.floor(new Date(tx.date).getTime() / 1000));
            netWorthData.push(totalAssets);
            profitData.push(totalProfit);
        });

        // Punto inicial si está vacío
        if (netWorthData.length === 0) {
            dates.push(Math.floor(Date.now() / 1000));
            netWorthData.push(0);
            profitData.push(0);
        }

        res.json({ dates, netWorth: netWorthData, profit: profitData });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error gráfica' });
    }
});

// 1. Portafolios (Contadores Reales)
app.get('/api/portfolios', async (req, res) => {
    try {
        const livePortfolios = await Promise.all(portfoliosBase.map(async (p) => {
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].count || 0);

            const totalCollected = p.baseAmount + realMoney;

            return {
                ...p,
                currentAmount: totalCollected,
                totalTickets: Math.floor(p.targetAmount / p.minInvestment),
                soldTickets: Math.floor(totalCollected / p.minInvestment),
                remainingTickets: Math.max(0, Math.floor(p.targetAmount / p.minInvestment) - Math.floor(totalCollected / p.minInvestment)),
                investors: p.baseInvestors + realInvestors
            };
        }));
        res.json(livePortfolios);
    } catch (error) { console.error(error); res.json(portfoliosBase); }
});

// ... RESTO DE RUTAS (Invest, Auth, etc. IGUALES) ...
app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        const investmentAmount = parseFloat(amount);
        const pid = parseInt(portfolioId);
        const portfolio = portfoliosBase.find(p => p.id === pid);

        if (!portfolio) return res.status(404).json({ message: 'Fondo no existe' });
        if (investmentAmount < portfolio.minInvestment || investmentAmount % portfolio.minInvestment !== 0) return res.status(400).json({ message: `Múltiplos de $${portfolio.minInvestment}` });
        if (parseFloat(user.balance) < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente.' });

        const existing = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, pid]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya tienes una posición activa.' });

        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', [user.id, pid, investmentAmount, new Date().toISOString()]);
        
        const slots = investmentAmount / portfolio.minInvestment;
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', [user.id, 'invest', `Inversión ${portfolio.name} (${slots} tickets)`, -investmentAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: 'Inversión exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error' }); }
});

// Helpers Rutas
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];if(!u)return r.status(404).send();const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){r.status(401).send()}});
app.get('/api/my-investments', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM investments WHERE userId=$1',[d.id]);const e=rs.rows.map(i=>{const a=parseFloat(i.amount);const p=portfoliosBase.find(o=>o.id===i.portfolioid);return{id:i.id,portfolioName:p?p.name:'-',risk:p?p.risk:'-',investedAmount:a,currentValue:a*1.015,profit:(a*1.015)-a,date:i.date}});r.json(e)}catch(e){r.status(500).send()}});
app.get('/api/transactions', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id DESC',[d.id]);r.json(rs.rows)}catch(e){r.status(500).send()}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0)return r.status(400).send();await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];if(!i)return r.status(404).send();const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/register', async(req,r)=>{const{email,password}=req.body;try{const x=await query('SELECT id FROM users WHERE email=$1',[email]);if(x.rows.length>0)return r.status(400).json({message:'Existe'});const h=await bcrypt.hash(password,10);const rs=await query('INSERT INTO users (email,password,balance) VALUES ($1,$2,$3) RETURNING id',[email,h,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[rs.rows[0].id,'deposit','Bono',50000,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).send();const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).send()}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });