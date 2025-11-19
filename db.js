// db.js - VERSIÓN POSTGRESQL
const { Pool } = require('pg');

// Usamos la variable de entorno DATABASE_URL si existe (Producción), 
// si no, usa una cadena local vacía (o hardcodeada para pruebas rápidas)
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Necesario para conexiones seguras en la nube
    }
});

async function query(text, params) {
    return pool.query(text, params);
}

async function initDb() {
    console.log("🔌 Conectando a PostgreSQL en la nube...");

    try {
        // 1. Tabla Usuarios (SERIAL es el AUTOINCREMENT de Postgres)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                balance DECIMAL(15, 2) DEFAULT 50000
            )
        `);

        // 2. Tabla Inversiones
        await pool.query(`
            CREATE TABLE IF NOT EXISTS investments (
                id SERIAL PRIMARY KEY,
                userId INTEGER REFERENCES users(id),
                portfolioId INTEGER,
                amount DECIMAL(15, 2),
                date TEXT
            )
        `);

        // 3. Tabla Transacciones
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

        console.log("✅ Tablas de PostgreSQL verificadas/creadas.");
        return pool;
    } catch (err) {
        console.error("❌ Error conectando a la BD:", err);
    }
}

module.exports = { query, initDb };