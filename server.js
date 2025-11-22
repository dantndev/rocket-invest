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

// --- CONFIGURACIÓN ---
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'rocket_secret_key';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// CORREO DEL ADMIN (IMPORTANTE: Regístrate con este correo para ver el panel admin)
const ADMIN_EMAIL = "admin@rocket.com";

app.use(cors());
app.use(bodyParser.json());
// Evitar caché
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => { if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript'); }
}));

// --- INICIALIZACIÓN DE BD ---
async function initApp() {
    await initDb(); // Tablas básicas (Users, Investments, Transactions)
    
    // Tabla extra para Partners (Solicitudes de fondos)
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS fund_requests (
                id SERIAL PRIMARY KEY,
                providerName TEXT,
                fundName TEXT,
                ticker TEXT,
                targetAmount DECIMAL(15, 2),
                description TEXT,
                status TEXT DEFAULT 'pending',
                date TEXT
            )
        `);
        console.log("✅ Tablas verificadas (Incluyendo Partners).");
    } catch (e) { console.error("Error DB:", e); }
}
initApp();

// --- EMAIL HELPER ---
async function sendEmail(to, subject, html) {
    if (!resend) return;
    try { await resend.emails.send({ from: 'RocketInvest <onboarding@resend.dev>', to, subject, html }); } 
    catch (e) { console.error("Error Mail:", e.message); }
}

// --- DATOS BASE ---
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

// ==========================================
// RUTAS DE ADMINISTRADOR (¡RECUPERADAS!)
// ==========================================
app.get('/api/admin/stats', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        // Validación de seguridad: Solo el admin entra
        if (decoded.email !== ADMIN_EMAIL) return res.status(403).json({ message: 'Acceso Denegado' });

        // 1. Usuarios
        const usersRes = await query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(usersRes.rows[0].count);

        // 2. Dinero Total (Saldo usuarios + Inversiones)
        const balanceRes = await query('SELECT SUM(balance) as total FROM users');
        const investRes = await query('SELECT SUM(amount) as total FROM investments');
        const totalAUM = (parseFloat(balanceRes.rows[0].total || 0) + parseFloat(investRes.rows[0].total || 0));

        // 3. Lista de Usuarios (Últimos 50)
        const listRes = await query('SELECT id, email, balance FROM users ORDER BY id DESC LIMIT 50');
        
        res.json({ totalUsers, totalAUM, users: listRes.rows });

    } catch (error) { console.error(error); res.status(500).json({ message: 'Error Admin API' }); }
});


// ==========================================
// RUTAS DE PARTNERS (B2B)
// ==========================================
app.post('/api/partner/stats', async (req, res) => {
    const { providerName } = req.body;
    try {
        const myFunds = portfoliosBase.filter(p => p.provider === providerName);
        if (myFunds.length === 0) return res.status(404).json({ message: 'Proveedor no encontrado' });

        let totalRaised = 0, totalInvestors = 0;
        const fundsDetails = [];

        await Promise.all(myFunds.map(async (p) => {
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            
            const raised = p.baseAmount + parseFloat(sumRes.rows[0].total || 0);
            const investors = p.baseInvestors + parseInt(countRes.rows[0].count || 0);
            
            totalRaised += raised;
            totalInvestors += investors;

            fundsDetails.push({
                id: p.id, name: p.name, raised: raised, target: p.targetAmount,
                progress: Math.min(100, (raised / p.targetAmount) * 100),
                investors: investors
            });
        }));

        res.json({ provider: providerName, totalRaised, totalInvestors, activeFunds: myFunds.length, funds: fundsDetails });
    } catch (error) { res.status(500).json({ message: 'Error Partner API' }); }
});

app.post('/api/partner/request', async (req, res) => {
    const { providerName, fundName, ticker, targetAmount, description } = req.body;
    try {
        await query('INSERT INTO fund_requests (providerName, fundName, ticker, targetAmount, description, date) VALUES ($1, $2, $3, $4, $5, $6)',
            [providerName, fundName, ticker, targetAmount, description, new Date().toISOString()]);
        res.json({ message: 'Solicitud enviada' });
    } catch (e) { res.status(500).json({ message: 'Error solicitud' }); }
});


// ==========================================
// RUTAS DE USUARIO (APP PRINCIPAL)
// ==========================================

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

app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = (await query('SELECT * FROM users WHERE id = $1', [decoded.id])).rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        const investmentAmount = parseFloat(amount);
        const pid = parseInt(portfolioId);
        const portfolio = portfoliosBase.find(p => p.id === pid);

        if (!portfolio) return res.status(404).json({ message: 'Fondo no existe' });
        if (investmentAmount < portfolio.minInvestment || investmentAmount % portfolio.minInvestment !== 0) {
            return res.status(400).json({ message: `Múltiplos de $${portfolio.minInvestment}` });
        }
        if (parseFloat(user.balance) < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente' });

        const existing = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, pid]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya eres socio.' });

        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', [user.id, pid, investmentAmount, new Date().toISOString()]);
        
        const slots = investmentAmount / portfolio.minInvestment;
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [user.id, 'invest', `Compra ${slots} tickets ${portfolio.name}`, -investmentAmount, new Date().toISOString()]);

        const nu = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        await sendEmail(user.email, 'Inversión Exitosa', `<h1>Has invertido $${investmentAmount}</h1><p>Fondo: ${portfolio.name}</p>`);
        res.status(201).json({ message: 'Exito', newBalance: parseFloat(nu.rows[0].balance) });
    } catch (error) { res.status(500).json({ message: 'Error inversión' }); }
});

// Rutas Standard
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];if(!u)return r.status(404).send();const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){r.status(401).send()}});
app.get('/api/market', async(req,r)=>{try{const k=process.env.TWELVEDATA_API_KEY;const x=await axios.get(`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${k}&outputsize=30`);if(x.data.values){const d=x.data.values.reverse();r.json({prices:d.map(i=>parseFloat(i.close)),dates:d.map(i=>Math.floor(new Date(i.datetime).getTime()/1000))})}else throw new Error()}catch{const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}r.json({prices:p,dates:d})}});
app.get('/api/my-investments', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM investments WHERE userId=$1',[d.id]);const e=rs.rows.map(i=>{const a=parseFloat(i.amount);const p=portfoliosBase.find(o=>o.id===i.portfolioid);return{id:i.id,portfolioName:p?p.name:'-',risk:p?p.risk:'-',investedAmount:a,currentValue:a*1.015,profit:(a*1.015)-a,date:i.date}});r.json(e)}catch(e){r.status(500).send()}});
app.get('/api/chart-data', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);const tx=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id ASC',[d.id]);const ds=[],n=[],pr=[];let c=0,inv=0,nd=0;tx.rows.forEach(x=>{const a=parseFloat(x.amount);if(x.type==='deposit'||x.type==='withdraw'){c+=a;nd+=a}else if(x.type==='invest'){c+=a;inv+=Math.abs(a)}else if(x.type==='sell'){c+=a;inv-=a/1.015}ds.push(Math.floor(new Date(x.date).getTime()/1000));n.push(c+inv);pr.push((c+inv)-nd)});if(n.length===0){ds.push(Math.floor(Date.now()/1000));n.push(0);pr.push(0)}r.json({dates:ds,netWorth:n,profit:pr})}catch(e){r.status(500).json({})}});
app.get('/api/transactions', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id DESC',[d.id]);r.json(rs.rows)}catch(e){r.status(500).send()}});
app.post('/api/create-payment-intent', async(req,r)=>{const{amount,token}=req.body;try{jwt.verify(token,SECRET_KEY);const p=await stripe.paymentIntents.create({amount:Math.round(parseFloat(amount)*100),currency:'mxn',automatic_payment_methods:{enabled:true}});r.json({clientSecret:p.client_secret})}catch(e){r.status(500).json({error:e.message})}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/register', async(req,r)=>{const{email,password}=req.body;try{const x=await query('SELECT id FROM users WHERE email=$1',[email]);if(x.rows.length>0)return r.status(400).json({message:'Existe'});const h=await bcrypt.hash(password,10);const rs=await query('INSERT INTO users (email,password,balance) VALUES ($1,$2,$3) RETURNING id',[email,h,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[rs.rows[0].id,'deposit','Bono',50000,new Date().toISOString()]);await sendEmail(email,'Bienvenido','<h1>Cuenta Creada</h1>');r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).send();const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).send()}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });