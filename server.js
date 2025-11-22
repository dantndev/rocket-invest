require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit'); // Para los contratos
const { Resend } = require('resend');
const { initDb, query } = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'rocket_secret_key';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// CONFIGURACIÓN ADMIN
const ADMIN_EMAIL = "admin@rocket.com"; // <--- IMPORTANTE: Regístrate con este correo

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => { if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript'); }
}));

// INICIALIZAR BD Y TABLAS EXTRA
async function initApp() {
    await initDb();
    try {
        // Tabla para solicitudes de Partners
        await query(`CREATE TABLE IF NOT EXISTS fund_requests (id SERIAL PRIMARY KEY, providerName TEXT, fundName TEXT, ticker TEXT, targetAmount DECIMAL(15, 2), description TEXT, status TEXT DEFAULT 'pending', date TEXT)`);
        console.log("✅ Tablas Admin/Partners listas.");
    } catch (e) { console.error("DB Error:", e); }
}
initApp();

// --- UTILIDADES ---
const formatFolio = (type, id) => {
    const prefix = { 'user': 'RI-USR', 'tx': 'RI-TXN', 'fund': 'RI-FND' }[type] || 'RI-GEN';
    return `${prefix}-${String(id).padStart(6, '0')}`;
};

async function sendEmail(to, subject, html) {
    if (!resend) return;
    try { await resend.emails.send({ from: 'RocketInvest <onboarding@resend.dev>', to, subject, html }); } 
    catch (e) { console.error("Error Mail:", e.message); }
}

// --- DATOS BASE ---
const portfoliosBase = [
    { id: 1, name: "Alpha Tech Giants", provider: "BlackRock", ticker: "QQQ", risk: "Alto", returnYTD: 99.99, targetAmount: 10000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Acceso grupal a las 100 tecnológicas más grandes." },
    { id: 2, name: "Deuda Soberana Plus", provider: "Santander", ticker: "SHV", risk: "Bajo", returnYTD: 8.12, targetAmount: 5000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "3 Meses", description: "Bonos de gobierno con tasa preferencial." },
    { id: 3, name: "Energía Limpia Global", provider: "iShares", ticker: "ICLN", risk: "Medio", returnYTD: 14.50, targetAmount: 2000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "24 Meses", description: "Infraestructura renovable global." },
    { id: 4, name: "Crypto Proxies", provider: "ProShares", ticker: "BITO", risk: "Alto", returnYTD: 145.20, targetAmount: 8000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Exposición a futuros de Bitcoin." },
    { id: 5, name: "Bienes Raíces FIBRAs", provider: "Fibra Uno", ticker: "VNQ", risk: "Medio", returnYTD: 12.30, targetAmount: 20000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Rentas comerciales diversificadas." },
    { id: 6, name: "Asian Tigers", provider: "HSBC Global", ticker: "VWO", risk: "Alto", returnYTD: 18.40, targetAmount: 5000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "18 Meses", description: "Mercados emergentes de Asia." },
    { id: 7, name: "Deuda Corporativa USA", provider: "Vanguard", ticker: "LQD", risk: "Bajo", returnYTD: 4.50, targetAmount: 10000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Bonos corporativos grado inversión." },
    { id: 8, name: "Gaming & eSports", provider: "VanEck", ticker: "ESPO", risk: "Alto", returnYTD: 32.10, targetAmount: 3000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Entretenimiento digital." },
    { id: 9, name: "Oro Físico", provider: "SPDR", ticker: "GLD", risk: "Medio", returnYTD: 9.80, targetAmount: 50000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "Indefinido", description: "Resguardo en lingotes reales." }
];


// ================= RUTAS ADMIN (ESTAS FALTABAN) =================
app.get('/api/admin/stats', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.email !== ADMIN_EMAIL) return res.status(403).json({ message: 'Acceso Denegado' });

        const u = await query('SELECT COUNT(*) as c FROM users');
        const b = await query('SELECT SUM(balance) as t FROM users');
        const i = await query('SELECT SUM(amount) as t FROM investments');
        const l = await query('SELECT id, email, balance FROM users ORDER BY id DESC LIMIT 50');
        
        res.json({
            totalUsers: parseInt(u.rows[0].c),
            totalAUM: (parseFloat(b.rows[0].t || 0) + parseFloat(i.rows[0].t || 0)),
            users: l.rows
        });
    } catch (e) { res.status(500).json({ message: 'Error Admin' }); }
});

// ================= RUTAS PARTNERS (ESTAS FALTABAN) =================
app.post('/api/partner/stats', async (req, res) => {
    const { providerName } = req.body;
    try {
        const myFunds = portfoliosBase.filter(p => p.provider === providerName);
        if (myFunds.length === 0) return res.status(404).json({ message: 'Sin fondos' });

        let totalRaised = 0, totalInvestors = 0;
        const funds = [];

        await Promise.all(myFunds.map(async p => {
            const s = await query('SELECT SUM(amount) as t FROM investments WHERE portfolioId=$1', [p.id]);
            const c = await query('SELECT COUNT(DISTINCT userId) as co FROM investments WHERE portfolioId=$1', [p.id]);
            const raised = p.baseAmount + parseFloat(s.rows[0].t || 0);
            const investors = p.baseInvestors + parseInt(c.rows[0].co || 0);
            totalRaised += raised; totalInvestors += investors;
            funds.push({ id: p.id, name: p.name, raised, target: p.targetAmount, progress: Math.min(100, (raised/p.targetAmount)*100), investors });
        }));

        res.json({ provider: providerName, totalRaised, totalInvestors, activeFunds: myFunds.length, funds });
    } catch (e) { res.status(500).json({ message: 'Error Partner' }); }
});

app.post('/api/partner/request', async (req, res) => {
    const { providerName, fundName, ticker, targetAmount, description } = req.body;
    try {
        await query('INSERT INTO fund_requests (providerName, fundName, ticker, targetAmount, description, date) VALUES ($1,$2,$3,$4,$5,$6)', [providerName, fundName, ticker, targetAmount, description, new Date().toISOString()]);
        res.json({ message: 'Solicitud enviada' });
    } catch (e) { res.status(500).json({ message: 'Error solicitud' }); }
});


// ================= RUTAS USUARIO / PDF / ETC =================

// PDF GENERATOR
app.get('/api/contract/:id', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).send('Acceso denegado');
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const txId = req.params.id;
        const txRes = await query('SELECT * FROM transactions WHERE id=$1 AND userId=$2', [txId, decoded.id]);
        if (txRes.rows.length === 0) return res.status(404).send('No encontrado');
        
        const tx = txRes.rows[0];
        const u = (await query('SELECT email FROM users WHERE id=$1', [decoded.id])).rows[0];
        const folioTx = formatFolio('tx', tx.id);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${folioTx}.pdf`);
        doc.pipe(res);

        // Diseño PDF
        doc.rect(0, 0, 612, 80).fill('#0f172a');
        doc.fillColor('#fff').fontSize(20).text('ROCKETINVEST', 50, 30);
        doc.fillColor('#000').moveDown(4);
        doc.fontSize(12).text(`Folio: ${folioTx}`, { align: 'right' });
        doc.text(`Usuario: ${u.email}`);
        doc.text(`Monto: $${parseFloat(tx.amount).toLocaleString('es-MX')}`);
        doc.text(`Concepto: ${tx.description}`);
        doc.text(`Fecha: ${new Date(tx.date).toLocaleString()}`);
        doc.moveDown();
        doc.font('Courier').fontSize(8).text(bcrypt.hashSync(folioTx, 1), { align: 'center' });
        doc.end();
    } catch (e) { res.status(500).send('Error PDF'); }
});

// CORE
app.get('/api/portfolios', async (req, res) => {
    try {
        const l = await Promise.all(portfoliosBase.map(async p => {
            const s = await query('SELECT SUM(amount) as t FROM investments WHERE portfolioId=$1', [p.id]);
            const c = await query('SELECT COUNT(DISTINCT userId) as co FROM investments WHERE portfolioId=$1', [p.id]);
            const rm = parseFloat(s.rows[0].t || 0);
            const ri = parseInt(c.rows[0].co || 0);
            const tc = p.baseAmount + rm;
            return { 
                ...p, 
                currentAmount: tc, 
                totalTickets: Math.floor(p.targetAmount / p.minInvestment),
                soldTickets: Math.floor(tc / p.minInvestment),
                remainingTickets: Math.max(0, Math.floor(p.targetAmount / p.minInvestment) - Math.floor(tc / p.minInvestment)),
                investors: p.baseInvestors + ri 
            };
        }));
        res.json(l);
    } catch (e) { res.json(portfoliosBase); }
});

// TRANSACTIONS, AUTH, INVEST (Estándar)
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){r.status(401).send()}});
app.post('/api/invest', async(req,r)=>{const{portfolioId,amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const ia=parseFloat(amount);const p=portfoliosBase.find(x=>x.id===parseInt(portfolioId));if(ia<p.minInvestment||ia%p.minInvestment!==0)return r.status(400).json({message:`Múltiplos de ${p.minInvestment}`});if(parseFloat(u.balance)<ia)return r.status(400).json({message:'Saldo insuficiente'});const e=await query('SELECT id FROM investments WHERE userId=$1 AND portfolioId=$2',[u.id,p.id]);if(e.rows.length>0)return r.status(400).json({message:'Ya eres socio'});await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[ia,u.id]);await query('INSERT INTO investments (userId,portfolioId,amount,date) VALUES ($1,$2,$3,$4)',[u.id,p.id,ia,new Date().toISOString()]);const s=ia/p.minInvestment;await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'invest',`Compra ${s} cupos ${p.name}`,-ia,new Date().toISOString()]);const nu=await query('SELECT balance FROM users WHERE id=$1',[u.id]);await sendEmail(u.email,'Inversión Confirmada',`<h1>Inversión exitosa</h1>`);r.status(201).json({message:'Exito',newBalance:parseFloat(nu.rows[0].balance)})}catch(e){r.status(500).json({message:'Error'})}});
app.get('/api/transactions', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id DESC',[d.id]);r.json(rs.rows.map(x=>({...x,folio:formatFolio('tx',x.id)})))}catch(e){r.status(500).send()}});
app.get('/api/my-investments', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM investments WHERE userId=$1 ORDER BY id DESC',[d.id]);const e=rs.rows.map(i=>{const a=parseFloat(i.amount);const p=portfoliosBase.find(o=>o.id===i.portfolioid);return{id:i.id,portfolioName:p?p.name:'-',risk:p?p.risk:'-',investedAmount:a,currentValue:a*1.015,profit:(a*1.015)-a,date:i.date}});r.json(e)}catch(e){r.status(500).send()}});
app.get('/api/chart-data', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);const tx=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id ASC',[d.id]);const ds=[],n=[],pr=[];let c=0,inv=0,nd=0;tx.rows.forEach(x=>{const a=parseFloat(x.amount);if(x.type==='deposit'||x.type==='withdraw'){c+=a;nd+=a}else if(x.type==='invest'){c+=a;inv+=Math.abs(a)}else if(x.type==='sell'){c+=a;inv-=a/1.015}ds.push(Math.floor(new Date(x.date).getTime()/1000));n.push(c+inv);pr.push((c+inv)-nd)});if(n.length===0){ds.push(Math.floor(Date.now()/1000));n.push(0);pr.push(0)}r.json({dates:ds,netWorth:n,profit:pr})}catch(e){r.status(500).json({})}});
app.get('/api/market', async(req,r)=>{try{const k=process.env.TWELVEDATA_API_KEY;const x=await axios.get(`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${k}&outputsize=30`);if(x.data.values){const d=x.data.values.reverse();r.json({prices:d.map(i=>parseFloat(i.close)),dates:d.map(i=>Math.floor(new Date(i.datetime).getTime()/1000))})}else throw new Error()}catch{const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}r.json({prices:p,dates:d})}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0)return r.status(400).send();await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];if(!i)return r.status(404).send();const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/register', async(req,r)=>{const{email,password}=req.body;try{const x=await query('SELECT id FROM users WHERE email=$1',[email]);if(x.rows.length>0)return r.status(400).json({message:'Existe'});const h=await bcrypt.hash(password,10);const rs=await query('INSERT INTO users (email,password,balance) VALUES ($1,$2,$3) RETURNING id',[email,h,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[rs.rows[0].id,'deposit','Bono Bienvenida',50000,new Date().toISOString()]);await sendEmail(email,'Bienvenido','<h1>Cuenta Creada</h1>');r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).send();const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).send()}});
app.post('/api/create-payment-intent', async(req,r)=>{const{amount,token}=req.body;try{jwt.verify(token,SECRET_KEY);const p=await stripe.paymentIntents.create({amount:Math.round(parseFloat(amount)*100),currency:'mxn',automatic_payment_methods:{enabled:true}});r.json({clientSecret:p.client_secret})}catch(e){r.status(500).json({error:e.message})}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });