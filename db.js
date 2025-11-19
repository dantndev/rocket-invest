// db.js
const { Pool } = require('pg');
require('dotenv').config(); // Aseguramos que cargue las variables

// FORZANDO LA URL DIRECTA PARA PROBAR
const connectionString = "postgresql://postgres:RocketInvest2025@db.odeipgmtgablhnazbvrn.supabase.co:6543/postgres";

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    },
    family: 4 // <--- ESTO FUERZA A USAR IPv4
});

async function query(text, params) {
    return pool.query(text, params);
}

async function initDb() {
    console.log("🔌 Intentando conectar a PostgreSQL...");
    
    try {
        // Prueba de conexión simple
        await pool.query('SELECT NOW()');
        console.log("✅ Conexión EXITOSA a la nube.");

        // Crear tablas...
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                balance DECIMAL(15, 2) DEFAULT 50000
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS investments (
                id SERIAL PRIMARY KEY,
                userId INTEGER REFERENCES users(id),
                portfolioId INTEGER,
                amount DECIMAL(15, 2),
                date TEXT
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                userId INTEGER REFERENCES users(id),
                type TEXT,
                description TEXT,
                amount DECIMAL(15, 2),
                date TEXT
            )
        `);

        console.log("✅ Tablas verificadas.");
        return pool;
    } catch (err) {
        console.error("❌ Error FATAL de conexión:", err.message);
        console.log("🔍 Consejo: Revisa si tu IP está bloqueada o si el puerto 6543 funciona.");
    }
}

module.exports = { query, initDb };