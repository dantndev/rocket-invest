require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
const { Resend } = require('resend');
const { initDb, query } = require('./db'); 

// CONFIGURACIÓN STRIPE (Tus claves)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'mi_secreto_super_seguro'; // En prod usar .env

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public')));

initDb();

// --- DATOS BASE (TODOS EN 0) ---
const portfoliosBase = [
    { id: 1, name: "Alpha Tech Giants", provider: "BlackRock", ticker: "QQQ", risk: "Alto", returnYTD: 99.99, targetAmount: 10000000, baseAmount: 0, baseInvestors: 0, minInvestment: 2000, lockUpPeriod: "12 Meses", description: "Acceso grupal a las 100 tecnológicas más grandes." },
    { id: 2, name: "Deuda Soberana Plus", provider: "Santander", ticker: "SHV", risk: "Bajo", returnYTD: 8.12, targetAmount: 5000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "3 Meses", description: "Bonos de gobierno con tasa preferencial." },
    { id: 3, name: "Energía Limpia Global", provider: "iShares", ticker: "ICLN", risk: "Medio", returnYTD: 14.50, targetAmount: 2000000, baseAmount: 0, baseInvestors: 0, minInvestment: 5000, lockUpPeriod: "24 Meses", description: "Infraestructura renovable global." },
    { id: 4, name: "Crypto Proxies", provider: "ProShares", ticker: "BITO", risk: "Alto", returnYTD: 145.20, targetAmount: 8000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Exposición a futuros de Bitcoin." },
    { id: 5, name: "Bienes Raíces FIBRAs", provider: "Fibra Uno", ticker: "VNQ", risk: "Medio", returnYTD: 12.30, targetAmount: 20000000, baseAmount: 0, baseInvestors: 0, minInvestment: 2000, lockUpPeriod: "12 Meses", description: "Rentas comerciales diversificadas." },
    { id: 6, name: "Asian Tigers", provider: "HSBC Global", ticker: "VWO", risk: "Alto", returnYTD: 18.40, targetAmount: 5000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "18 Meses", description: "Mercados emergentes de Asia." },
    { id: 7, name: "Deuda Corporativa USA", provider: "Vanguard", ticker: "LQD", risk: "Bajo", returnYTD: 4.50, targetAmount: 10000000, baseAmount: 0, baseInvestors: 0, minInvestment: 5000, lockUpPeriod: "6 Meses", description: "Bonos corporativos grado inversión." },
    { id: 8, name: "Gaming & eSports", provider: "VanEck", ticker: "ESPO", risk: "Alto", returnYTD: 32.10, targetAmount: 3000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Entretenimiento digital." },
    { id: 9, name: "Oro Físico", provider: "SPDR", ticker: "GLD", risk: "Medio", returnYTD: 9.80, targetAmount: 50000000, baseAmount: 0, baseInvestors: 0, minInvestment: 10000, lockUpPeriod: "Indefinido", description: "Resguardo en lingotes reales." }
];

// --- RUTAS ---

// 1. STRIPE INTENT
app.post('/api/create-payment-intent', async (req, res) => {
    const { amount, token } = req.body;
    try {
        jwt.verify(token, SECRET_KEY);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(parseFloat(amount) * 100), // Centavos
            currency: 'mxn',
            automatic_payment_methods: { enabled: true },
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e) {
        console.error("Stripe Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// 2. PORTAFOLIOS (Calculo Real)
app.get('/api/portfolios', async (req, res) => {
    try {
        const livePortfolios = await Promise.all(portfoliosBase.map(async (p) => {
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].count || 0);

            const totalCollected = p.baseAmount + realMoney;
            const totalTickets = Math.floor(p.targetAmount / p.minInvestment);
            const soldTickets = Math.floor(totalCollected / p.minInvestment);

            return {
                ...p,
                currentAmount: totalCollected,
                totalTickets: totalTickets,
                soldTickets: soldTickets,
                remainingTickets: Math.max(0, totalTickets - soldTickets),
                investors: p.baseInvestors + realInvestors
            };
        }));
        res.json(livePortfolios);
    } catch (error) { res.json(portfoliosBase); }
});

// 3. MIS INVERSIONES (Arreglado para investments.js)
app.get('/api/my-investments', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const result = await query('SELECT * FROM investments WHERE userId = $1 ORDER BY id DESC', [decoded.id]);
        
        const enriched = result.rows.map(inv => {
            const amount = parseFloat(inv.amount);
            const pid = parseInt(inv.portfolioid);
            const portfolio = portfoliosBase.find(p => p.id === pid);
            // Cálculo simple de ganancia simulada
            const currentVal = amount * 1.015; 
            return {
                id: inv.id,
                portfolioName: portfolio ? portfolio.name : `Fondo #${pid}`,
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

// 4. HISTORIAL (Arreglado para history.js)
app.get('/api/transactions', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const result = await query('SELECT * FROM transactions WHERE userId = $1 ORDER BY id DESC', [decoded.id]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: 'Error historial' }); }
});

// 5. CHART DATA (Capital vs Profit)
app.get('/api/chart-data', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const txRes = await query('SELECT * FROM transactions WHERE userId = $1 ORDER BY id ASC', [decoded.id]);
        
        const dates = [], netWorth = [], profit = [];
        let cash = 0, invested = 0, deposits = 0;

        txRes.rows.forEach(tx => {
            const amt = parseFloat(tx.amount);
            if (tx.type === 'deposit') { cash += amt; deposits += amt; }
            else if (tx.type === 'withdraw') { cash += amt; deposits += amt; }
            else if (tx.type === 'invest') { cash += amt; invested += Math.abs(amt); }
            else if (tx.type === 'sell') { cash += amt; invested -= (amt / 1.015); }
            
            dates.push(Math.floor(new Date(tx.date).getTime() / 1000));
            netWorth.push(cash + invested);
            profit.push((cash + invested) - deposits);
        });

        if (netWorth.length === 0) { dates.push(Math.floor(Date.now()/1000)); netWorth.push(0); profit.push(0); }
        res.json({ dates, netWorth, profit });
    } catch (e) { res.status(500).json({ message: 'Error chart' }); }
});

// ... OTRAS RUTAS DE OPERACIÓN (IGUALES) ...
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];if(!u)return r.status(404).send();const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){r.status(401).send()}});
app.post('/api/invest', async(req,r)=>{const{portfolioId,amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const ia=parseFloat(amount);const p=portfoliosBase.find(x=>x.id===parseInt(portfolioId));if(ia<p.minInvestment||ia%p.minInvestment!==0)return r.status(400).json({message:`Múltiplos de $${p.minInvestment}`});if(parseFloat(u.balance)<ia)return r.status(400).json({message:'Saldo insuficiente'});const e=await query('SELECT id FROM investments WHERE userId=$1 AND portfolioId=$2',[u.id,p.id]);if(e.rows.length>0)return r.status(400).json({message:'Ya eres socio'});await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[ia,u.id]);await query('INSERT INTO investments (userId,portfolioId,amount,date) VALUES ($1,$2,$3,$4)',[u.id,p.id,ia,new Date().toISOString()]);const s=ia/p.minInvestment;await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'invest',`Compra ${s} cupos ${p.name}`,-ia,new Date().toISOString()]);const nu=await query('SELECT balance FROM users WHERE id=$1',[u.id]);r.status(201).json({message:'Exito',newBalance:parseFloat(nu.rows[0].balance)})}catch(e){console.error(e);r.status(500).json({message:'Error'})}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0)return r.status(400).send();await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];if(!i)return r.status(404).send();const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/register', async(req,r)=>{const{email,password}=req.body;try{const x=await query('SELECT id FROM users WHERE email=$1',[email]);if(x.rows.length>0)return r.status(400).json({message:'Existe'});const h=await bcrypt.hash(password,10);const rs=await query('INSERT INTO users (email,password,balance) VALUES ($1,$2,$3) RETURNING id',[email,h,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[rs.rows[0].id,'deposit','Bono',50000,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).send();const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).send()}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });