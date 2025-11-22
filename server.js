require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const { initDb, query } = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'rocket_secret_key';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// CORRECCIÓN: EL CORREO DEL ADMIN QUE PEDISTE
const ADMIN_EMAIL = "rocket@admin.com"; 

// Configuración Multer
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, uploadDir), filename: (req, file, cb) => cb(null, `kyc-${Date.now()}-${file.originalname}`) });
const upload = multer({ storage: storage });

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res, filePath) => { if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript'); } }));

initDb();

// --- UTILS ---
const formatFolio = (t, i) => `${{user:'RI-USR',tx:'RI-TXN',fund:'RI-FND'}[t]||'RI-GEN'}-${String(i).padStart(6,'0')}`;
async function sendEmail(to, s, h) { if(!resend)return; try{await resend.emails.send({from:'RocketInvest <onboarding@resend.dev>',to,subject:s,html:h})}catch(e){console.error(e.message)} }

// --- DATA ---
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

// --- RUTAS ---
app.get('/api/portfolios', async(req,r)=>{try{const l=await Promise.all(portfoliosBase.map(async p=>{const s=await query('SELECT SUM(amount) as t FROM investments WHERE portfolioId=$1',[p.id]);const c=await query('SELECT COUNT(DISTINCT userId) as co FROM investments WHERE portfolioId=$1',[p.id]);const rm=parseFloat(s.rows[0].t||0);const ri=parseInt(c.rows[0].c||0);const tc=p.baseAmount+rm;return{...p,currentAmount:tc,totalTickets:Math.floor(p.targetAmount/p.minInvestment),soldTickets:Math.floor(tc/p.minInvestment),remainingTickets:Math.max(0,Math.floor(p.targetAmount/p.minInvestment)-Math.floor(tc/p.minInvestment)),investors:p.baseInvestors+ri}}));r.json(l)}catch{r.json(portfoliosBase)}});

// AUTH
app.post('/api/auth/register', async(req,r)=>{const{email,password,first_name,last_name}=req.body;try{const x=await query('SELECT id FROM users WHERE email=$1',[email]);if(x.rows.length>0)return r.status(400).json({message:'Existe'});const h=await bcrypt.hash(password,10);const rs=await query('INSERT INTO users (email,password,first_name,last_name,balance) VALUES ($1,$2,$3,$4,$5) RETURNING id',[email,h,first_name,last_name,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[rs.rows[0].id,'deposit','Bono Bienvenida',50000,new Date().toISOString()]);await sendEmail(email,'Bienvenido',`<h1>Hola ${first_name}</h1>`);r.status(201).json({message:'OK'})}catch{r.status(500).json({message:'Error'})}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).json({message:'Error'});const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).json({message:'Error'})}});
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({id:u.id,email:u.email,first_name:u.first_name,last_name:u.last_name,kyc_status:u.kyc_status,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch{r.status(401).send()}});

// TRANSACTIONS
app.post('/api/invest', async(req,r)=>{const{portfolioId,amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const ia=parseFloat(amount);const p=portfoliosBase.find(x=>x.id===parseInt(portfolioId));if(ia<p.minInvestment||ia%p.minInvestment!==0)return r.status(400).json({message:`Múltiplos de ${p.minInvestment}`});if(parseFloat(u.balance)<ia)return r.status(400).json({message:'Saldo insuficiente'});const e=await query('SELECT id FROM investments WHERE userId=$1 AND portfolioId=$2',[u.id,p.id]);if(e.rows.length>0)return r.status(400).json({message:'Ya eres socio'});await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[ia,u.id]);await query('INSERT INTO investments (userId,portfolioId,amount,date) VALUES ($1,$2,$3,$4)',[u.id,p.id,ia,new Date().toISOString()]);const s=ia/p.minInvestment;await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'invest',`Inversión ${p.name}`,-ia,new Date().toISOString()]);const nu=await query('SELECT balance FROM users WHERE id=$1',[u.id]);await sendEmail(u.email,'Inversión',`<h1>Compra de ${s} cupos</h1>`);r.status(201).json({message:'Exito',newBalance:parseFloat(nu.rows[0].balance)})}catch{r.status(500).json({message:'Error'})}});
app.post('/api/create-payment-intent', async(req,r)=>{const{amount,token}=req.body;try{jwt.verify(token,SECRET_KEY);const p=await stripe.paymentIntents.create({amount:Math.round(parseFloat(amount)*100),currency:'mxn',automatic_payment_methods:{enabled:true}});r.json({clientSecret:p.client_secret})}catch(e){r.status(500).json({error:e.message})}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});

// ADMIN & PARTNER
app.get('/api/admin/stats', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);if(d.email!==ADMIN_EMAIL)return r.status(403).json({});const u=await query('SELECT COUNT(*) as c FROM users');const b=await query('SELECT SUM(balance) as t FROM users');const i=await query('SELECT SUM(amount) as t FROM investments');const l=await query('SELECT id,email,balance,first_name,last_name FROM users ORDER BY id DESC LIMIT 50');r.json({totalUsers:parseInt(u.rows[0].c),totalAUM:(parseFloat(b.rows[0].t||0)+parseFloat(i.rows[0].t||0)),users:l.rows})}catch{r.status(500).json({})}});
app.post('/api/partner/stats', async(req,r)=>{const{providerName}=req.body;try{const mf=portfoliosBase.filter(p=>p.provider===providerName);if(mf.length===0)return r.status(404).json({});let tr=0,ti=0;const fd=[];await Promise.all(mf.map(async p=>{const s=await query('SELECT SUM(amount) as t FROM investments WHERE portfolioId=$1',[p.id]);const c=await query('SELECT COUNT(DISTINCT userId) as co FROM investments WHERE portfolioId=$1',[p.id]);const ra=p.baseAmount+parseFloat(s.rows[0].t||0);const inu=p.baseInvestors+parseInt(c.rows[0].co||0);tr+=ra;ti+=inu;fd.push({id:p.id,name:p.name,raised:ra,target:p.targetAmount,progress:Math.min(100,(ra/p.targetAmount)*100),investors:inu})}));r.json({provider:providerName,totalRaised:tr,totalInvestors:ti,activeFunds:mf.length,funds:fd})}catch{r.status(500).json({})}});
app.post('/api/partner/request', async(req,r)=>{const{providerName,fundName,ticker,targetAmount,description}=req.body;try{await query('INSERT INTO fund_requests (providerName,fundName,ticker,targetAmount,description,date) VALUES ($1,$2,$3,$4,$5,$6)',[providerName,fundName,ticker,targetAmount,description,new Date().toISOString()]);r.json({message:'OK'})}catch{r.status(500).json({})}});

// INFO & FILES
app.get('/api/market', async(req,r)=>{try{const k=process.env.TWELVEDATA_API_KEY;const x=await axios.get(`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${k}&outputsize=30`);if(x.data.values){const d=x.data.values.reverse();r.json({prices:d.map(i=>parseFloat(i.close)),dates:d.map(i=>Math.floor(new Date(i.datetime).getTime()/1000))})}else throw new Error()}catch{const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}r.json({prices:p,dates:d})}});
app.get('/api/chart-data', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);const tx=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id ASC',[d.id]);const ds=[],n=[],pr=[];let c=0,inv=0,nd=0;tx.rows.forEach(x=>{const a=parseFloat(x.amount);if(x.type==='deposit'||x.type==='withdraw'){c+=a;nd+=a}else if(x.type==='invest'){c+=a;inv+=Math.abs(a)}else if(x.type==='sell'){c+=a;inv-=a/1.015}ds.push(Math.floor(new Date(x.date).getTime()/1000));n.push(c+inv);pr.push((c+inv)-nd)});if(n.length===0){ds.push(Math.floor(Date.now()/1000));n.push(0);pr.push(0)}r.json({dates:ds,netWorth:n,profit:pr})}catch(e){r.status(500).json({})}});
app.post('/api/kyc/upload', upload.single('document'), async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);const{rfc,curp,phone}=req.body;if(!req.file)return r.status(400).json({});const du=`/uploads/${req.file.filename}`;await query(`UPDATE users SET rfc=$1,curp=$2,phone=$3,document_url=$4,kyc_status='pending' WHERE id=$5`,[rfc,curp,phone,du,d.id]);setTimeout(async()=>{await query(`UPDATE users SET kyc_status='verified' WHERE id=$1`,[d.id])},15000);r.json({message:'OK'})}catch{r.status(500).json({})}});
app.get('/api/auth/profile', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();try{const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];r.json(u)}catch{r.status(500).send()}});
app.get('/api/contract/:id', async(req,res)=>{const token=req.query.token;if(!token)return res.status(401).send();try{const decoded=jwt.verify(token,SECRET_KEY);const txId=req.params.id;const txRes=await query('SELECT * FROM transactions WHERE id=$1 AND userId=$2',[txId,decoded.id]);if(txRes.rows.length===0)return res.status(404).send();const tx=txRes.rows[0];const u=(await query('SELECT email,first_name,last_name FROM users WHERE id=$1',[decoded.id])).rows[0];const folioTx=formatFolio('tx',tx.id);const doc=new PDFDocument({margin:50});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment;filename=${folioTx}.pdf`);doc.pipe(res);doc.fontSize(20).text('ROCKETINVEST',{align:'center'});doc.moveDown();doc.fontSize(12).text(`Folio: ${folioTx}`);doc.text(`Cliente: ${u.first_name} ${u.last_name}`);doc.text(`Monto: $${parseFloat(tx.amount).toLocaleString('es-MX')}`);doc.text(`Fecha: ${tx.date}`);doc.end();}catch{res.status(500).send()}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });