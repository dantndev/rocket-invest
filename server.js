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
app.use(express.static(path.join(__dirname, 'public')));

initDb();

// --- DATOS BASE (CONFIGURACIÓN) ---
const portfoliosBase = [
    { id: 1, name: "Alpha Tech Giants", provider: "BlackRock", ticker: "QQQ", risk: "Alto", returnYTD: 99.99, targetInvestors: 5000, baseInvestors: 3420, baseAmount: 7545000, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Acceso grupal a las 100 tecnológicas más grandes." },
    { id: 2, name: "Deuda Soberana Plus", provider: "Santander", ticker: "SHV", risk: "Bajo", returnYTD: 8.12, targetInvestors: 10000, baseInvestors: 8900, baseAmount: 4800000, minInvestment: 1000, lockUpPeriod: "3 Meses", description: "Bonos de gobierno con tasa preferencial." },
    { id: 3, name: "Energía Limpia Global", provider: "iShares", ticker: "ICLN", risk: "Medio", returnYTD: 14.50, targetInvestors: 2000, baseInvestors: 45, baseAmount: 150000, minInvestment: 1000, lockUpPeriod: "24 Meses", description: "Infraestructura renovable global." },
    { id: 4, name: "Crypto Proxies", provider: "ProShares", ticker: "BITO", risk: "Alto", returnYTD: 145.20, targetInvestors: 1000, baseInvestors: 80, baseAmount: 1200000, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Exposición a futuros de Bitcoin." },
    { id: 5, name: "Bienes Raíces FIBRAs", provider: "Fibra Uno", ticker: "VNQ", risk: "Medio", returnYTD: 12.30, targetInvestors: 5000, baseInvestors: 1400, baseAmount: 15000000, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Rentas comerciales diversificadas." },
    { id: 6, name: "Asian Tigers", provider: "HSBC Global", ticker: "VWO", risk: "Alto", returnYTD: 18.40, targetInvestors: 2000, baseInvestors: 40, baseAmount: 500000, minInvestment: 1000, lockUpPeriod: "18 Meses", description: "Mercados emergentes de Asia." },
    { id: 7, name: "Deuda Corporativa USA", provider: "Vanguard", ticker: "LQD", risk: "Bajo", returnYTD: 4.50, targetInvestors: 8000, baseInvestors: 2000, baseAmount: 9000000, minInvestment: 1000, lockUpPeriod: "6 Meses", description: "Bonos corporativos grado inversión." },
    { id: 8, name: "Gaming & eSports", provider: "VanEck", ticker: "ESPO", risk: "Alto", returnYTD: 32.10, targetInvestors: 3000, baseInvestors: 900, baseAmount: 2800000, minInvestment: 1000, lockUpPeriod: "12 Meses", description: "Entretenimiento digital." },
    { id: 9, name: "Oro Físico", provider: "SPDR", ticker: "GLD", risk: "Medio", returnYTD: 9.80, targetInvestors: 6000, baseInvestors: 3100, baseAmount: 41000000, minInvestment: 1000, lockUpPeriod: "Indefinido", description: "Resguardo en lingotes reales." }
];

// 1. GET PORTAFOLIOS (CALCULADO)
app.get('/api/portfolios', async (req, res) => {
    try {
        const livePortfolios = await Promise.all(portfoliosBase.map(async (p) => {
            // Contar dinero real de la BD
            const sumRes = await query('SELECT SUM(amount) as total FROM investments WHERE portfolioId = $1', [p.id]);
            const realMoney = parseFloat(sumRes.rows[0].total || 0);
            
            // Contar socios reales de la BD
            const countRes = await query('SELECT COUNT(DISTINCT userId) as count FROM investments WHERE portfolioId = $1', [p.id]);
            const realInvestors = parseInt(countRes.rows[0].count || 0);

            return {
                ...p,
                currentAmount: p.baseAmount + realMoney, 
                currentInvestors: p.baseInvestors + realInvestors,
                // Alias para frontend
                investors: p.baseInvestors + realInvestors 
            };
        }));
        res.json(livePortfolios);
    } catch (error) {
        console.error("Error calculando:", error);
        res.json(portfoliosBase); // Fallback si falla la BD
    }
});

// 2. INVERTIR (LÓGICA CORREGIDA)
app.post('/api/invest', async (req, res) => {
    const { portfolioId, amount, token } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        const user = userRes.rows[0];
        
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        
        const investmentAmount = parseFloat(amount);
        // Validaciones
        if (investmentAmount < 1000 || investmentAmount % 1000 !== 0) return res.status(400).json({ message: 'Monto inválido. Múltiplos de $1,000.' });
        if (parseFloat(user.balance) < investmentAmount) return res.status(400).json({ message: 'Saldo insuficiente.' });

        // Verificar si ya invirtió en este fondo
        const existing = await query('SELECT id FROM investments WHERE userId = $1 AND portfolioId = $2', [user.id, portfolioId]);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Ya eres socio de este fondo.' });

        const portfolio = portfoliosBase.find(p => p.id === parseInt(portfolioId));

        // Ejecutar
        await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [investmentAmount, user.id]);
        await query('INSERT INTO investments (userId, portfolioId, amount, date) VALUES ($1, $2, $3, $4)', 
            [user.id, portfolioId, investmentAmount, new Date().toISOString()]);
        
        await query('INSERT INTO transactions (userId, type, description, amount, date) VALUES ($1, $2, $3, $4, $5)', 
            [user.id, 'invest', `Entrada a ${portfolio ? portfolio.name : 'Fondo'}`, -investmentAmount, new Date().toISOString()]);

        const updatedUserRes = await query('SELECT balance FROM users WHERE id = $1', [user.id]);
        res.status(201).json({ message: 'Inversión exitosa', newBalance: parseFloat(updatedUserRes.rows[0].balance) });

    } catch (error) { 
        console.error("Error Invest:", error); 
        res.status(500).json({ message: 'Error en el servidor' }); 
    }
});

// ... (RESTO DE RUTAS: Auth, Deposit, Withdraw, Market, etc. COPIALAS DE LA VERSIÓN ANTERIOR O PÍDEMELAS SI LAS PERDISTE.
// Para que esto funcione, deben estar aquí abajo. Por espacio no las repito todas, pero las de arriba eran las críticas).
// SI NECESITAS EL SERVER AL 100% CON TODO REPETIDO DIMELO.
// ...

// BLOQUE DE RUTAS ESTÁNDAR (RESUMEN PARA QUE COPIES)
app.get('/api/transactions', async(req,res)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return res.status(401).json({});const d=jwt.verify(t,SECRET_KEY);const r=await query('SELECT * FROM transactions WHERE userId=$1 ORDER BY id DESC',[d.id]);res.json(r.rows)}catch(e){res.status(500).json({})}});
app.get('/api/auth/me', async(req,res)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return res.status(401).json({});const d=jwt.verify(t,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];if(!u)return res.status(404).json({});const i=await query('SELECT amount FROM investments WHERE userId=$1',[u.id]);let ti=0,tc=0;i.rows.forEach(x=>{ti+=parseFloat(x.amount);tc+=parseFloat(x.amount)*1.015});res.json({email:u.email,availableBalance:parseFloat(u.balance),investedAmount:ti,currentValue:tc,profit:tc-ti,netWorth:parseFloat(u.balance)+tc})}catch(e){res.status(401).json({})}});
app.get('/api/my-investments', async(req,res)=>{try{const t=req.headers.authorization?.split(' ')[1];if(!t)return res.status(401).json({});const d=jwt.verify(t,SECRET_KEY);const r=await query('SELECT * FROM investments WHERE userId=$1',[d.id]);const e=r.rows.map(x=>{const a=parseFloat(x.amount);const p=portfoliosBase.find(o=>o.id===x.portfolioid);const c=a*1.015;return{id:x.id,portfolioName:p?p.name:'-',risk:p?p.risk:'N/A',investedAmount:a,currentValue:c,profit:c-a,date:x.date}});res.json(e)}catch(e){res.status(500).json({})}});
app.post('/api/deposit', async(req,res)=>{try{const{amount,token}=req.body;const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0)return res.status(400).json({});await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'deposit','Depósito',a,new Date().toISOString()]);const nu=(await query('SELECT balance FROM users WHERE id=$1',[u.id])).rows[0];res.status(201).json({newBalance:parseFloat(nu.balance)})}catch(e){res.status(500).json({})}});
app.post('/api/withdraw', async(req,res)=>{try{const{amount,token}=req.body;const d=jwt.verify(token,SECRET_KEY);const u=(await query('SELECT * FROM users WHERE id=$1',[d.id])).rows[0];const a=parseFloat(amount);if(a<=0||u.balance<a)return res.status(400).json({});await query('UPDATE users SET balance=balance-$1 WHERE id=$2',[a,u.id]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[u.id,'withdraw','Retiro',-a,new Date().toISOString()]);const nu=(await query('SELECT balance FROM users WHERE id=$1',[u.id])).rows[0];res.status(201).json({newBalance:parseFloat(nu.balance)})}catch(e){res.status(500).json({})}});
app.post('/api/sell', async(req,res)=>{try{const{investmentId,token}=req.body;const d=jwt.verify(token,SECRET_KEY);const i=(await query('SELECT * FROM investments WHERE id=$1 AND userId=$2',[investmentId,d.id])).rows[0];if(!i)return res.status(404).json({});const f=parseFloat(i.amount)*1.015;await query('UPDATE users SET balance=balance+$1 WHERE id=$2',[f,d.id]);await query('DELETE FROM investments WHERE id=$1',[investmentId]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[d.id,'sell','Venta',f,new Date().toISOString()]);const nu=(await query('SELECT balance FROM users WHERE id=$1',[d.id])).rows[0];res.status(200).json({newBalance:parseFloat(nu.balance)})}catch(e){res.status(500).json({})}});
app.get('/api/market', async(req,res)=>{try{const t=process.env.TWELVEDATA_API_KEY;if(!t)throw new Error();const u=`https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&apikey=${t}&outputsize=30`;const r=await axios.get(u);if(r.data.values){const d=r.data.values.reverse();res.json({prices:d.map(x=>parseFloat(x.close)),dates:d.map(x=>Math.floor(new Date(x.datetime).getTime()/1000))})}else throw new Error()}catch(e){const p=[],d=[];let c=180;for(let i=0;i<30;i++){c*=1+(Math.random()*0.06-0.025);p.push(c.toFixed(2));d.push(Math.floor(Date.now()/1000)-((30-1-i)*86400))}res.json({prices:p,dates:d})}});
app.post('/api/auth/register', async(req,res)=>{try{const{email,password}=req.body;const e=await query('SELECT id FROM users WHERE email=$1',[email]);if(e.rows.length>0)return res.status(400).json({});const h=await bcrypt.hash(password,10);const r=await query('INSERT INTO users (email,password,balance) VALUES ($1,$2,$3) RETURNING id',[email,h,50000]);await query('INSERT INTO transactions (userId,type,description,amount,date) VALUES ($1,$2,$3,$4,$5)',[r.rows[0].id,'deposit','Bono',50000,new Date().toISOString()]);res.status(201).json({message:'ok'})}catch(e){res.status(500).json({})}});
app.post('/api/auth/login', async(req,res)=>{try{const u=(await query('SELECT * FROM users WHERE email=$1',[req.body.email])).rows[0];if(!u||!(await bcrypt.compare(req.body.password,u.password)))return res.status(400).json({});const t=jwt.sign({id:u.id,email:u.email},SECRET_KEY,{expiresIn:'1h'});res.json({token:t})}catch(e){res.status(500).json({})}});

app.listen(PORT, () => { console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`); });