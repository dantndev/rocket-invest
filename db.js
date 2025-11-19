// db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ ERROR: No se encontró DATABASE_URL.");
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: true, // Configuración correcta para Neon
});

async function query(text, params) {
    return pool.query(text, params);
}

async function initDb() {
    console.log("🔌 Conectando a NeonDB...");
    
    try {
        await pool.query('SELECT 1'); 
        console.log("✅ ¡CONEXIÓN EXITOSA A NEON!");

        // Crear tablas
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