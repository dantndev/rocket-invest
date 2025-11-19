// db.js
const { Pool } = require('pg');
require('dotenv').config(); // Carga variables si estás en local

// 1. Leemos la URL segura
const connectionString = process.env.DATABASE_URL;

// Validación
if (!connectionString) {
    console.error("❌ ERROR FATAL: No se encontró la variable DATABASE_URL.");
    process.exit(1);
}

// 2. Configuración del Pool
const pool = new Pool({
    connectionString: connectionString,
    ssl: true, 
    family: 4 // <--- OBLIGATORIO PARA TU RED LOCAL (Fuerza IPv4)
});

// Función para ejecutar consultas
async function query(text, params) {
    return pool.query(text, params);
}

// Función de inicialización
async function initDb() {
    console.log("🔌 Conectando a la Base de Datos...");
    
    try {
        await pool.query('SELECT 1'); 
        console.log("✅ ¡CONEXIÓN EXITOSA!");

        // Tablas...
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
        console.error("❌ Error de conexión con la Base de Datos:", err.message);
    }
}

module.exports = { query, initDb };