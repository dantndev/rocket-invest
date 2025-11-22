require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
const fs = require('fs'); // NECESARIO PARA ARCHIVOS
const multer = require('multer'); // NECESARIO PARA SUBIDAS
const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const { initDb, query } = require('./db'); 

// --- CONFIGURACIÓN GENERAL ---
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'rocket_secret_key';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = "admin@rocket.com";

// --- CONFIGURACIÓN MULTER (ESTO FALTABA) ---
// Configurar dónde se guardan los archivos temporales (INE/Pasaporte)
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `kyc-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Servir archivos estáticos (JS, CSS, HTML e Imágenes subidas)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => { 
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript'); 
    }
}));

initDb();

// --- INICIALIZAR BD ---
async function initApp() {
    await initDb();
    try {
        // Tablas extras
        await query(`CREATE TABLE IF NOT EXISTS fund_requests (id SERIAL PRIMARY KEY, providerName TEXT, fundName TEXT, ticker TEXT, targetAmount DECIMAL(15, 2), description TEXT, status TEXT DEFAULT 'pending', date TEXT)`);
        
        // Columnas nuevas para usuarios (KYC)
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT`);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rfc TEXT`);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS curp TEXT`);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unverified'`);
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_url TEXT`);

        console.log("✅ Base de datos sincronizada.");
    } catch (e) { console.error("Error DB Init:", e); }
}
initApp();

// --- UTILS ---
const formatFolio = (t, i) => `${{user:'RI-USR',tx:'RI-TXN',fund:'RI-FND'}[t]||'RI-GEN'}-${String(i).padStart(6,'0')}`;

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

// --- RUTAS API ---

// 1. KYC UPLOAD (ESTA ES LA RUTA QUE FALLABA POR FALTA DE 'upload')
app.post('/api/kyc/upload', upload.single('document'), async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No autorizado' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const { rfc, curp, phone } = req.body;
        
        if (!req.file) return res.status(400).json({ message: 'Debes subir un documento.' });
        
        // Ruta relativa para guardar en BD
        const docUrl = `/uploads/${req.file.filename}`;

        await query(
            `UPDATE users SET rfc=$1, curp=$2, phone=$3, document_url=$4, kyc_status='pending' WHERE id=$5`,
            [rfc, curp, phone, docUrl, decoded.id]
        );

        // Simular verificación en 15s
        setTimeout(async () => {
            await query(`UPDATE users SET kyc_status='verified' WHERE id=$1`, [decoded.id]);
        }, 15000);

        res.json({ message: 'Documentos recibidos.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error procesando KYC' });
    }
});

// 2. PORTAFOLIOS
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

// 3. REGISTRO (CON NOMBRES)
app.post('/api/auth/register', async (req, res) => {
    const { email, password, first_name, last_name } = req.body;
    try {
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'El usuario ya existe' });

        const hashed = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO users (email, password, first_name, last_name, balance) VALUES ($1, $2, $3, $4, $5) RETURNING id', 
            [email, hashed, first_name || '', last_name || '', 50000]
        );
        const newUserId = result.rows[0].id;

        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [newUserId, 'deposit', 'Bono de Bienvenida', 50000, new Date().toISOString()]);

        await sendEmail(email, 'Bienvenido a RocketInvest 🚀', `<h1>¡Hola ${first_name}!</h1><p>Tu cuenta está lista.</p>`);

        res.status(201).json({ message: 'Cuenta creada con éxito' });
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error al crear cuenta' }); }
});

// 4. LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0 || !(await bcrypt.compare(password, userRes.rows[0].password))) 
            return res.status(400).json({ message: 'Credenciales inválidas' });
        
        const token = jwt.sign({ id: userRes.rows[0].id, email: userRes.rows[0].email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, message: 'Login exitoso' });
    } catch (e) { res.status(500).json({ message: 'Error login' }); }
});

// 5. INVERTIR
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
        if (investmentAmount < portfolio.minInvestment || investmentAmount % portfolio.minInvestment !== 0) 
            return res.status(400).json({ message: `Múltiplos de $${portfolio.minInvestment}` });
        if (parseFloat(user.balance) < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente.' });

        const existing = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, pid]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya tienes una posición activa.' });

        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', [user.id, pid, investmentAmount, new Date().toISOString()]);
        
        const slots = investmentAmount / portfolio.minInvestment;
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [user.id, 'invest', `Compra de ${slots} cupos en ${portfolio.name}`, -investmentAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        await sendEmail(user.email, 'Inversión Exitosa', `<h1>Has invertido $${investmentAmount}</h1>`);
        
        res.status(201).json({ message: 'Inversión exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error inversión' }); }
});

// 6. PDF GENERATOR
app.get('/api/contract/:id', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).send('Acceso denegado');
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const txId = req.params.id;
        const txRes = await query('SELECT * FROM transactions WHERE id = $1 AND userId = $2', [txId, decoded.id]);
        if (txRes.rows.length === 0) return res.status(404).send('No encontrado');
        
        const tx = txRes.rows[0];
        const userRes = await query('SELECT email, first_name, last_name FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        const folioTx = formatFolio('tx', tx.id);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${folioTx}.pdf`);
        doc.pipe(res);

        doc.rect(0, 0, 612, 100).fill('#0f172a');
        doc.fillColor('#fff').fontSize(24).text('ROCKETINVEST', 50, 40);
        doc.fillColor('#000').moveDown(6);
        doc.fontSize(12).text(`Folio: ${folioTx}`, { align: 'right' });
        doc.text(`Cliente: ${user.first_name} ${user.last_name}`);
        doc.text(`Monto: $${parseFloat(tx.amount).toLocaleString('es-MX')}`);
        doc.text(`Fecha: ${new Date(tx.date).toLocaleString()}`);
        doc.end();
    } catch (error) { res.status(500).send('Error PDF'); }
});

// ... Rutas Estándar (Admin, Partners, Deposit, Withdraw, Market, etc) ...
// (Estas NO usan 'upload', así que no causan error. Las mantengo aquí para que esté completo)
app.get('/api/admin/stats', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);if(d.email!==ADMIN_EMAIL)return r.status(403).json({});const u=await query('SELECT COUNT(*) as c FROM users');const b=await query('SELECT SUM(balance) as t FROM users');const i=await query('SELECT SUM(amount) as t FROM investments');const l=await query('SELECT id,email,balance FROM users ORDER BY id DESC LIMIT 50');r.json({totalUsers:parseInt(u.rows[0].c),totalAUM:(parseFloat(b.rows[0].t||0)+parseFloat(i.rows[0].t||0)),users:l.rows})}catch{r.status(500).json({})}});
app.post('/api/partner/stats', async(req,r)=>{const{providerName}=req.body;try{const mf=portfoliosBase.filter(p=>p.provider===providerName);if(mf.length===0)return r.status(404).json({});let tr=0,ti=0;const fd=[];await Promise.all(mf.map(async p=>{const s=await query('SELECT SUM(amount) as t FROM investments WHERE portfolioId=$1',[p.id]);const c=await query('SELECT COUNT(DISTINCT userId) as co FROM investments WHERE portfolioId=$1',[p.id]);const ra=p.baseAmount+parseFloat(s.rows[0].t||0);const inu=p.baseInvestors+parseInt(c.rows[0].co||0);tr+=ra;ti+=inu;fd.push({id:p.id,name:p.name,raised:ra,target:p.targetAmount,progress:Math.min(100,(ra/p.targetAmount)*100),investors:inu})}));r.json({provider:providerName,totalRaised:tr,totalInvestors:ti,activeFunds:mf.length,funds:fd})}catch{r.status(500).json({})}});
app.post('/api/partner/request', async(req,r)=>{const{providerName,fundName,ticker,targetAmount,description}=req.body;try{await query('INSERT INTO fund_requests (providerName,fundName,ticker,targetAmount,description,date) VALUES ($1,$2,$3,$4,$5,$6)',[providerName,fundName,ticker,targetAmount,description,new Date().toISOString()]);r.json({message:'OK'})}catch{r.status(500).json({})}});
app.get('/api/auth/profile', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();try{const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];r.json(u)}catch{r.status(500).send()}});
app.get('/api/market', async(req,r)=>{try{const k=process.env.TWELVEDATA_API_KEY;const x=await axios.get(`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${k}&outputsize=30`);if(x.data.values){const d=x.data.values.reverse();r.json({prices:d.map(i=>parseFloat(i.close)),dates:d.map(i=>Math.floor(new Date(i.datetime).getTime()/1000))})}else throw new Error()}catch{const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}r.json({prices:p,dates:d})}});
app.get('/api/my-investments', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM investments WHERE userId=$1 ORDER BY id DESC',[d.id]);const e=rs.rows.map(i=>{const a=parseFloat(i.amount);const p=portfoliosBase.find(o=>o.id===i.portfolioid);return{id:i.id,portfolioName:p?p.name:'-',risk:p?p.risk:'-',investedAmount:a,currentValue:a*1.015,profit:(a*1.015)-a,date:i.date}});r.json(e)}catch(e){r.status(500).send()}});
app.get('/api/transactions', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id DESC',[d.id]);r.json(rs.rows.map(x=>({...x,folio:formatFolio('tx',x.id)})))}catch(e){r.status(500).send()}});
app.get('/api/chart-data', async(req,r)=>{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).json({});try{const d=jwt.verify(t,SECRET_KEY);const tx=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id ASC',[d.id]);const ds=[],n=[],pr=[];let c=0,inv=0,nd=0;tx.rows.forEach(x=>{const a=parseFloat(x.amount);if(x.type==='deposit'||x.type==='withdraw'){c+=a;nd+=a}else if(x.type==='invest'){c+=a;inv+=Math.abs(a)}else if(x.type==='sell'){c+=a;inv-=a/1.015}ds.push(Math.floor(new Date(x.date).getTime()/1000));n.push(c+inv);pr.push((c+inv)-nd)});if(n.length===0){ds.push(Math.floor(Date.now()/1000));n.push(0);pr.push(0)}r.json({dates:ds,netWorth:n,profit:pr})}catch(e){r.status(500).json({})}});
app.post('/api/create-payment-intent', async(req,r)=>{const{amount,token}=req.body;try{jwt.verify(token,SECRET_KEY);const p=await stripe.paymentIntents.create({amount:Math.round(parseFloat(amount)*100),currency:'mxn',automatic_payment_methods:{enabled:true}});r.json({clientSecret:p.client_secret})}catch(e){r.status(500).json({error:e.message})}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0)return r.status(400).send();await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];if(!i)return r.status(404).send();const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });