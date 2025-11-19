// db.js
const { Pool } = require('pg');

// 1. URL DIRECTA con el puerto 5432 (Más estable para servidores como Render)
const connectionString = "postgresql://postgres:RocketInvest2025@db.odeipgmtgablhnazbvrn.supabase.co:5432/postgres";

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Acepta el certificado de Supabase
    },
    family: 4 // <--- ¡ESTO ES LA CLAVE! Obliga a usar IPv4 y evita el error ENETUNREACH
});

async function query(text, params) {
    return pool.query(text, params);
}

async function initDb() {
    console.log("🔌 Intentando conectar a PostgreSQL (IPv4)...");
    
    try {
        // Prueba de conexión rápida
        await pool.query('SELECT NOW()');
        console.log("✅ ¡CONEXIÓN EXITOSA!");

        // Crear tablas si no existen
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
        console.error("❌ Error de conexión:", err);
    }
}

module.exports = { query, initDb };