require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const { initDb, query } = require('./db'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'rocket_secret_key';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = "admin@rocket.com";

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => { if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript'); }
}));

initDb();

// --- 📇 SISTEMA DE FOLIOS (ESTANDARIZACIÓN) ---
const formatFolio = (type, id) => {
    // RI = RocketInvest
    // USR = Usuario, TXN = Transacción, FND = Fondo
    const prefix = {
        'user': 'RI-USR',
        'tx': 'RI-TXN',
        'fund': 'RI-FND'
    }[type] || 'RI-GEN';
    
    // Rellena con ceros: 1 -> 000001
    return `${prefix}-${String(id).padStart(6, '0')}`;
};

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

// --- EMAIL HELPER ---
async function sendEmail(to, subject, html) {
    if (!resend) return;
    try { await resend.emails.send({ from: 'RocketInvest <onboarding@resend.dev>', to, subject, html }); } 
    catch (e) { console.error("Error Mail:", e.message); }
}

// --- RUTAS API ---

// 1. GENERADOR DE CONTRATO (PDF PROFESIONAL CON FOLIOS)
app.get('/api/contract/:id', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).send('Acceso denegado');

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const txId = req.params.id;
        const txRes = await query('SELECT * FROM transactions WHERE id = $1 AND userId = $2', [txId, decoded.id]);
        if (txRes.rows.length === 0) return res.status(404).send('No encontrado');
        
        const tx = txRes.rows[0];
        const userRes = await query('SELECT email FROM users WHERE id = $1', [decoded.id]);
        
        // GENERAR FOLIOS
        const folioTx = formatFolio('tx', tx.id);
        const folioUser = formatFolio('user', decoded.id);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${folioTx}.pdf`);
        doc.pipe(res);

        // HEADER CORPORATIVO
        doc.rect(0, 0, 612, 80).fill('#0f172a'); // Banner oscuro
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('ROCKETINVEST', 50, 30);
        doc.fontSize(10).font('Helvetica').text('Comprobante Fiscal Digital', 450, 35);
        
        doc.fillColor('#000000').moveDown(4);

        // DATOS DEL FOLIO
        doc.fontSize(10).font('Helvetica-Bold').text(`FOLIO ÚNICO: ${folioTx}`, { align: 'right' });
        doc.font('Helvetica').text(`Fecha de Emisión: ${new Date().toLocaleString('es-MX')}`, { align: 'right' });
        doc.moveDown();

        // DATOS DEL CLIENTE
        doc.rect(50, 160, 512, 25).fill('#f3f4f6');
        doc.fillColor('#333333').font('Helvetica-Bold').text('DATOS DEL INVERSIONISTA', 60, 167);
        doc.moveDown(1.5);
        doc.font('Helvetica').text(`ID de Cliente: ${folioUser}`);
        doc.text(`Email Registrado: ${userRes.rows[0].email}`);
        doc.moveDown();

        // DETALLES DE LA OPERACIÓN
        doc.rect(50, 240, 512, 25).fill('#f3f4f6');
        doc.fillColor('#333333').font('Helvetica-Bold').text('DETALLES DE LA OPERACIÓN', 60, 247);
        
        const typeMap = { 'invest': 'Suscripción de Títulos', 'deposit': 'Abono en Cuenta', 'withdraw': 'Retiro de Capital', 'sell': 'Liquidación de Posición' };
        
        doc.moveDown(1.5);
        doc.font('Helvetica').text(`Tipo de Movimiento: ${typeMap[tx.type] || tx.type}`);
        doc.text(`Concepto: ${tx.description}`);
        doc.moveDown();
        
        doc.fontSize(14).font('Helvetica-Bold').text(`MONTO TOTAL: $${parseFloat(tx.amount).toLocaleString('es-MX')} MXN`, { align: 'right' });
        
        // SELLO DIGITAL (Simulado)
        doc.moveDown(4);
        doc.fontSize(8).font('Helvetica').text('SELLO DIGITAL DE AUTENTICIDAD (SHA-256):', { align: 'center' });
        doc.font('Courier').text(bcrypt.hashSync(folioTx + tx.date, 1), { align: 'center', width: 400, align: 'center' });
        
        doc.moveDown(2);
        doc.font('Helvetica').text('Este documento avala la operación realizada en la plataforma RocketInvest conforme a los Términos y Condiciones.', { align: 'center' });

        doc.end();
    } catch (error) { res.status(500).send('Error PDF'); }
});

// 2. HISTORIAL (AHORA DEVUELVE FOLIOS)
app.get('/api/transactions', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const result = await query('SELECT * FROM transactions WHERE userId = $1 ORDER BY id DESC', [decoded.id]);
        
        // Inyectamos el folio formateado en la respuesta
        const formattedRows = result.rows.map(row => ({
            ...row,
            folio: formatFolio('tx', row.id)
        }));
        
        res.json(formattedRows);
    } catch (error) { res.status(500).json({ message: 'Error historial' }); }
});

// 3. PORTAFOLIOS (Con IDs de fondo formateados)
app.get('/api/portfolios', async (req, res) => {
    try {
        const livePortfolios = await Promise.all(portfoliosBase.map(async (p) => {
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].count || 0);

            return {
                ...p,
                fundId: formatFolio('fund', p.id), // Nuevo ID formateado
                currentAmount: p.baseAmount + realMoney,
                totalTickets: Math.floor(p.targetAmount / p.minInvestment),
                soldTickets: Math.floor((p.baseAmount + realMoney) / p.minInvestment),
                remainingTickets: Math.max(0, Math.floor(p.targetAmount / p.minInvestment) - Math.floor((p.baseAmount + realMoney) / p.minInvestment)),
                investors: p.baseInvestors + realInvestors
            };
        }));
        res.json(livePortfolios);
    } catch (error) { res.json(portfoliosBase); }
});

// ... RUTAS ESTÁNDAR (Sin cambios lógicos, solo copiadas para integridad) ...
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];if(!u)return r.status(404).send();const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({userId: formatFolio('user',u.id), email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){r.status(401).send()}});
app.get('/api/market', async(req,r)=>{try{const k=process.env.TWELVEDATA_API_KEY;const x=await axios.get(`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${k}&outputsize=30`);if(x.data.values){const d=x.data.values.reverse();r.json({prices:d.map(i=>parseFloat(i.close)),dates:d.map(i=>Math.floor(new Date(i.datetime).getTime()/1000))})}else throw new Error()}catch{const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}r.json({prices:p,dates:d})}});
app.get('/api/my-investments', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM investments WHERE userId=$1 ORDER BY id DESC',[d.id]);const e=rs.rows.map(i=>{const a=parseFloat(i.amount);const p=portfoliosBase.find(o=>o.id===i.portfolioid);return{id:i.id,portfolioName:p?p.name:'-',risk:p?p.risk:'-',investedAmount:a,currentValue:a*1.015,profit:(a*1.015)-a,date:i.date}});r.json(e)}catch(e){r.status(500).send()}});
app.get('/api/chart-data', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);const tx=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id ASC',[d.id]);const ds=[],n=[],pr=[];let c=0,inv=0,nd=0;tx.rows.forEach(x=>{const a=parseFloat(x.amount);if(x.type==='deposit'||x.type==='withdraw'){c+=a;nd+=a}else if(x.type==='invest'){c+=a;inv+=Math.abs(a)}else if(x.type==='sell'){c+=a;inv-=a/1.015}ds.push(Math.floor(new Date(x.date).getTime()/1000));n.push(c+inv);pr.push((c+inv)-nd)});if(n.length===0){ds.push(Math.floor(Date.now()/1000));n.push(0);pr.push(0)}r.json({dates:ds,netWorth:n,profit:pr})}catch(e){r.status(500).json({})}});
app.post('/api/invest', async(req,r)=>{const{portfolioId,amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const ia=parseFloat(amount);const p=portfoliosBase.find(x=>x.id===parseInt(portfolioId));if(ia<p.minInvestment||ia%p.minInvestment!==0)return r.status(400).json({message:`Múltiplos de ${p.minInvestment}`});if(parseFloat(u.balance)<ia)return r.status(400).json({message:'Saldo insuficiente'});const e=await query('SELECT id FROM investments WHERE userId=$1 AND portfolioId=$2',[u.id,p.id]);if(e.rows.length>0)return r.status(400).json({message:'Ya eres socio'});await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[ia,u.id]);await query('INSERT INTO investments (userId,portfolioId,amount,date) VALUES ($1,$2,$3,$4)',[u.id,p.id,ia,new Date().toISOString()]);const s=ia/p.minInvestment;await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'invest',`Compra ${s} tickets ${p.name}`,-ia,new Date().toISOString()]);const nu=await query('SELECT balance FROM users WHERE id=$1',[u.id]);await sendEmail(u.email,'Inversión Confirmada',`<h1>Inversión en ${p.name}</h1><p>Folio: ${formatFolio('tx', Date.now())}</p>`);r.status(201).json({message:'Exito',newBalance:parseFloat(nu.rows[0].balance)})}catch(e){console.error(e);r.status(500).json({message:'Error'})}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0)return r.status(400).send();await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];if(!i)return r.status(404).send();const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/register', async(req,r)=>{const{email,password}=req.body;try{const x=await query('SELECT id FROM users WHERE email=$1',[email]);if(x.rows.length>0)return r.status(400).json({message:'Existe'});const h=await bcrypt.hash(password,10);const rs=await query('INSERT INTO users (email,password,balance) VALUES ($1,$2,$3) RETURNING id',[email,h,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[rs.rows[0].id,'deposit','Bono Bienvenida',50000,new Date().toISOString()]);await sendEmail(email,'Bienvenido','<h1>Cuenta Creada</h1>');r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).send();const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).send()}});
app.post('/api/create-payment-intent', async(req,r)=>{const{amount,token}=req.body;try{jwt.verify(token,SECRET_KEY);const p=await stripe.paymentIntents.create({amount:Math.round(parseFloat(amount)*100),currency:'mxn',automatic_payment_methods:{enabled:true}});r.json({clientSecret:p.client_secret})}catch(e){r.status(500).json({error:e.message})}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });