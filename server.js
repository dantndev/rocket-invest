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
const SECRET_KEY = process.env.SECRET_KEY || 'rocket_secret_key';

app.use(cors());
app.use(bodyParser.json());
// Headers para evitar caché y que los contadores se actualicen al momento
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

initDb();

// --- DATOS BASE (TODOS EN CERO PARA QUE SEAS EL PRIMERO) ---
const portfoliosBase = [
    { 
        id: 1, name: "Alpha Tech Giants", provider: "BlackRock", ticker: "QQQ", risk: "Alto", returnYTD: 99.99, 
        targetAmount: 10000000, // Meta $10M
        baseAmount: 0,          // 0 Recaudado
        baseInvestors: 0,       // 0 Socios
        minInvestment: 1000, 
        lockUpPeriod: "12 Meses", 
        description: "Acceso grupal a las 100 tecnológicas más grandes." 
    },
    { 
        id: 2, name: "Deuda Soberana Plus", provider: "Santander", ticker: "SHV", risk: "Bajo", returnYTD: 8.12, 
        targetAmount: 5000000, 
        baseAmount: 0, 
        baseInvestors: 0, 
        minInvestment: 1000, 
        lockUpPeriod: "3 Meses", 
        description: "Bonos de gobierno con tasa preferencial." 
    },
    { 
        id: 3, name: "Energía Limpia Global", provider: "iShares", ticker: "ICLN", risk: "Medio", returnYTD: 14.50, 
        targetAmount: 2000000, 
        baseAmount: 0, 
        baseInvestors: 0, 
        minInvestment: 1000, 
        lockUpPeriod: "24 Meses", 
        description: "Infraestructura renovable global." 
    },
    { id: 4, name: "Crypto Proxies", provider: "ProShares", ticker: "BITO", risk: "Alto", returnYTD: 145.20, targetAmount: 8000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Exposición a futuros de Bitcoin." },
    { id: 5, name: "Bienes Raíces FIBRAs", provider: "Fibra Uno", ticker: "VNQ", risk: "Medio", returnYTD: 12.30, targetAmount: 20000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Rentas comerciales diversificadas." },
    { id: 6, name: "Asian Tigers", provider: "HSBC Global", ticker: "VWO", risk: "Alto", returnYTD: 18.40, targetAmount: 5000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "18 Meses", description: "Mercados emergentes de Asia." },
    { id: 7, name: "Deuda Corporativa USA", provider: "Vanguard", ticker: "LQD", risk: "Bajo", returnYTD: 4.50, targetAmount: 10000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Bonos corporativos grado inversión." },
    { id: 8, name: "Gaming & eSports", provider: "VanEck", ticker: "ESPO", risk: "Alto", returnYTD: 32.10, targetAmount: 3000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Entretenimiento digital." },
    { id: 9, name: "Oro Físico", provider: "SPDR", ticker: "GLD", risk: "Medio", returnYTD: 9.80, targetAmount: 50000000, baseAmount: 0, baseInvestors: 0, minInvestment: 1000, lockUpPeriod: "Indefinido", description: "Resguardo en lingotes reales." }
];

// --- RUTAS API ---

// 1. Portafolios (Calcula lo real de la BD)
app.get('/api/portfolios', async (req, res) => {
    try {
        const livePortfolios = await Promise.all(portfoliosBase.map(async (p) => {
            // Sumar dinero real de la BD
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);
            
            // Contar socios reales (tú serás el primero)
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].count || 0);

            const totalCollected = p.baseAmount + realMoney;

            return {
                ...p,
                currentAmount: totalCollected,
                // Datos para el frontend:
                totalTickets: Math.floor(p.targetAmount / p.minInvestment),
                soldTickets: Math.floor(totalCollected / p.minInvestment),
                // Alias para compatibilidad
                investors: p.baseInvestors + realInvestors
            };
        }));
        res.json(livePortfolios);
    } catch (error) {
        console.error(error);
        res.json(portfoliosBase); // Fallback si la BD falla
    }
});

// 2. REGISTRO (Aquí se da el bono de 50k)
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'El usuario ya existe' });

        const hashed = await bcrypt.hash(password, 10);
        
        // CREAR USUARIO CON 50,000 DE SALDO INICIAL
        const result = await query('INSERT INTO users (email, password, balance) VALUES ($1, $2, $3) RETURNING id', [email, hashed, 50000]);
        const newUserId = result.rows[0].id;

        // REGISTRAR EL BONO EN EL HISTORIAL
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [newUserId, 'deposit', 'Bono de Bienvenida', 50000, new Date().toISOString()]);

        res.status(201).json({ message: 'Cuenta creada con éxito' });
    } catch (e) { 
        console.error(e); 
        res.status(500).json({ message: 'Error al crear cuenta' }); 
    }
});

// 3. Invertir (Valida cupos y saldo)
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

        if (investmentAmount < portfolio.minInvestment || investmentAmount % portfolio.minInvestment !== 0) {
            return res.status(400).json({ message: `El monto debe ser múltiplo de $${portfolio.minInvestment}` });
        }
        if (parseFloat(user.balance) < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente' });

        // Bloqueo de doble participación
        const existing = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, pid]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya eres socio de este fondo.' });

        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', [user.id, pid, investmentAmount, new Date().toISOString()]);
        
        const slotsBought = investmentAmount / portfolio.minInvestment;
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [user.id, 'invest', `Compra de ${slotsBought} cupos en ${portfolio.name}`, -investmentAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: 'Inversión exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });

    } catch (error) { console.error(error); res.status(500).json({ message: 'Error procesando inversión' }); }
});

// ... Resto de rutas estándar (Login, Me, Market, etc) ...
// (Mantenemos las mismas de siempre para ahorrar espacio, pero asegúrate de que estén en tu archivo final)
app.get('/api/auth/me', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];if(!u)return r.status(404).send();const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});r.json({email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){r.status(401).send()}});
app.get('/api/market', async(req,r)=>{try{const t=process.env.TWELVEDATA_API_KEY;const u=`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${t}&outputsize=30`;const x=await axios.get(u);if(x.data.values){const d=x.data.values.reverse();r.json({prices:d.map(i=>parseFloat(i.close)),dates:d.map(i=>Math.floor(new Date(i.datetime).getTime()/1000))})}else throw new Error()}catch{const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}r.json({prices:p,dates:d})}});
app.get('/api/my-investments', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM investments WHERE userId=$1',[d.id]);const e=rs.rows.map(i=>{const a=parseFloat(i.amount);const p=portfoliosBase.find(o=>o.id===i.portfolioid);return{id:i.id,portfolioName:p?p.name:'-',risk:p?p.risk:'-',investedAmount:a,currentValue:a*1.015,profit:(a*1.015)-a,date:i.date}});r.json(e)}catch(e){r.status(500).send()}});
app.get('/api/transactions', async(req,r)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return r.status(401).send();const d=jwt.verify(t,SECRET_KEY);const rs=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id DESC',[d.id]);r.json(rs.rows)}catch(e){r.status(500).send()}});
app.post('/api/deposit', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0)return r.status(400).send();await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/withdraw', async(req,r)=>{const{amount,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return r.status(400).send();await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);r.status(201).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/sell', async(req,r)=>{const{investmentId,token}=req.body;try{const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1',[investmentId])).rows[0];if(!i)return r.status(404).send();const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);r.status(200).json({message:'OK'})}catch{r.status(500).send()}});
app.post('/api/auth/login', async(req,r)=>{const{email,password}=req.body;try{const u=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];if(!u||!(await bcrypt.compare(password,u.password)))return r.status(400).send();const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});r.json({token:t})}catch{r.status(500).send()}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });