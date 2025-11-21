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

// INICIALIZAR STRIPE (Con tu clave secreta)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'rocket_secret_key';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => { if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript'); }
}));

initDb();

// --- EMAILS ---
async function sendEmail(to, subject, html) {
    if (!resend) return;
    try { await resend.emails.send({ from: 'RocketInvest <onboarding@resend.dev>', to, subject, html }); } 
    catch (e) { console.error("Error mail:", e.message); }
}

// --- DATOS BASE ---
const portfoliosBase = [
    { id: 1, name: "Alpha Tech Giants", provider: "BlackRock", ticker: "QQQ", risk: "Alto", returnYTD: 99.99, targetAmount: 10000000, baseAmount: 8500000, minInvestment: 2000, lockUpPeriod: "12 Meses", description: "Acceso grupal a las 100 tecnológicas más grandes." },
    { id: 2, name: "Deuda Soberana Plus", provider: "Santander", ticker: "SHV", risk: "Bajo", returnYTD: 8.12, targetAmount: 5000000, baseAmount: 100000, minInvestment: 1000, lockUpPeriod: "3 Meses", description: "Bonos de gobierno con tasa preferencial." },
    { id: 3, name: "Energía Limpia Global", provider: "iShares", ticker: "ICLN", risk: "Medio", returnYTD: 14.50, targetAmount: 15000000, baseAmount: 7500000, minInvestment: 5000, lockUpPeriod: "24 Meses", description: "Infraestructura renovable global." },
    { id: 4, name: "Crypto Proxies", provider: "ProShares", ticker: "BITO", risk: "Alto", returnYTD: 145.20, targetAmount: 8000000, baseAmount: 7900000, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Exposición a futuros de Bitcoin." },
    { id: 5, name: "Bienes Raíces FIBRAs", provider: "Fibra Uno", ticker: "VNQ", risk: "Medio", returnYTD: 12.30, targetAmount: 20000000, baseAmount: 5000000, minInvestment: 2000, lockUpPeriod: "12 Meses", description: "Rentas comerciales diversificadas." },
    { id: 6, name: "Asian Tigers", provider: "HSBC Global", ticker: "VWO", risk: "Alto", returnYTD: 18.40, targetAmount: 5000000, baseAmount: 1000000, minInvestment: 1000, lockUpPeriod: "18 Meses", description: "Mercados emergentes de Asia." },
    { id: 7, name: "Deuda Corporativa USA", provider: "Vanguard", ticker: "LQD", risk: "Bajo", returnYTD: 4.50, targetAmount: 10000000, baseAmount: 9000000, minInvestment: 5000, lockUpPeriod: "6 Meses", description: "Bonos corporativos grado inversión." },
    { id: 8, name: "Gaming & eSports", provider: "VanEck", ticker: "ESPO", risk: "Alto", returnYTD: 32.10, targetAmount: 3000000, baseAmount: 2990000, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Entretenimiento digital." },
    { id: 9, name: "Oro Físico", provider: "SPDR", ticker: "GLD", risk: "Medio", returnYTD: 9.80, targetAmount: 50000000, baseAmount: 48000000, minInvestment: 10000, lockUpPeriod: "Indefinido", description: "Resguardo en lingotes reales." }
];

// --- RUTAS ---

// 1. NUEVO: CREAR INTENCIÓN DE PAGO (STRIPE)
app.post('/api/create-payment-intent', async (req, res) => {
    const { amount, token } = req.body;
    try {
        jwt.verify(token, SECRET_KEY); // Validar usuario
        
        // Stripe funciona en CENTAVOS (100 pesos = 10000 centavos)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, 
            currency: 'mxn',
            automatic_payment_methods: { enabled: true },
        });

        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (e) {
        console.error("Stripe Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 2. DEPOSITAR (Ahora solo se llama cuando Stripe confirma éxito)
app.post('/api/deposit', async (req, res) => {
    const { amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = (await query('SELECT * FROM users WHERE id=$1', [decoded.id])).rows[0];
        
        const val = parseFloat(amount);
        if (val <= 0) return res.status(400).json({ message: 'Monto inválido' });

        await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [val, user.id]);
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [user.id, 'deposit', 'Depósito vía Stripe', val, new Date().toISOString()]);
        
        res.status(201).json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// ... (RESTO DE RUTAS MANTENIDAS IGUAL: Portfolios, Invest, Withdraw, Auth, etc) ...
app.get('/api/portfolios', async(req,r)=>{try{const l=await Promise.all(portfoliosBase.map(async p=>{const s=await query('SELECT SUM(amount) as t FROM investments WHERE portfolioId=$1',[p.id]);const rm=parseFloat(s.rows[0].t||0);const c=await query('SELECT COUNT(DISTINCT userId) as c FROM investments WHERE portfolioId=$1',[p.id]);const ri=parseInt(c.rows[0].c||0);const tc=p.baseAmount+rm;return{...p,currentAmount:tc,totalTickets:Math.floor(p.targetAmount/p.minInvestment),soldTickets:Math.floor(tc/p.minInvestment),remainingTickets:Math.max(0,Math.floor(p.targetAmount/p.minInvestment)-Math.floor(tc/p.minInvestment)),investors:p.baseInvestors+ri}}));r.json(l)}catch(e){r.json(portfoliosBase)}});
app.post('/api/invest', async(req,r)=>{const{portfolioId,amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const ia=parseFloat(amount);const p=portfoliosBase.find(x=>x.id===parseInt(portfolioId));if(ia<p.minInvestment||ia%p.minInvestment!==0)return r.status(400).json({message:`Múltiplos de ${p.minInvestment}`});if(parseFloat(u.balance)<ia)return r.status(400).json({message:'Saldo insuficiente'});const e=await query('SELECT id FROM investments WHERE userId=$1 AND portfolioId=$2',[u.id,p.id]);if(e.rows.length>0)return r.status(400).json({message:'Ya eres socio'});await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[ia,u.id]);await query('INSERT INTO investments (userId,portfolioId,amount,date) VALUES ($1,$2,$3,$4)',[u.id,p.id,ia,new Date().toISOString()]);const s=ia/p.minInvestment;await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'invest',`Compra ${s} tickets ${p.name}`,-ia,new Date().toISOString()]);const nu=await query('SELECT balance FROM users WHERE id=$1',[u.id]);await sendEmail(u.email,'Inversión Confirmada',`<h1>Has invertido $${ia} en ${p.name}</h1>`);r.status(201).json({message:'Exito',newBalance:parseFloat(nu.rows[0].balance)})}catch(e){r.status(500).json({message:'Error'})}});
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){r.status(401).send()}});
app.get('/api/market', async(req,r)=>{try{const k=process.env.TWELVEDATA_API_KEY;const res=await axios.get(`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${k}&outputsize=30`);if(res.data.values){const d=res.data.values.reverse();r.json({prices:d.map(x=>parseFloat(x.close)),dates:d.map(x=>Math.floor(new Date(x.datetime).getTime()/1000))})}else throw new Error()}catch{const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}r.json({prices:p,dates:d})}});
app.get('/api/chart-data', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);const tx=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id ASC',[d.id]);const ds=[],n=[],pr=[];let c=0,inv=0,nd=0;tx.rows.forEach(x=>{const a=parseFloat(x.amount);if(x.type==='deposit'||x.type==='withdraw'){c+=a;nd+=a}else if(x.type==='invest'){c+=a;inv+=Math.abs(a)}else if(x.type==='sell'){c+=a;inv-=a/1.015}const ta=c+inv;ds.push(Math.floor(new Date(x.date).getTime()/1000));n.push(ta);pr.push(ta-nd)});if(n.length===0){ds.push(Math.floor(Date.now()/1000));n.push(0);pr.push(0)}r.json({dates:ds,netWorth:n,profit:pr})}catch(e){r.status(500).json({})}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/register', async(req,r)=>{const{email,password}=req.body;try{const x=await query('SELECT id FROM users WHERE email=$1',[email]);if(x.rows.length>0)return r.status(400).json({message:'Existe'});const h=await bcrypt.hash(password,10);const rs=await query('INSERT INTO users (email,password,balance) VALUES ($1,$2,$3) RETURNING id',[email,h,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[rs.rows[0].id,'deposit','Bono Bienvenida',50000,new Date().toISOString()]);await sendEmail(email,'Bienvenido','<h1>Cuenta Creada</h1>');r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).send();const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).send()}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });