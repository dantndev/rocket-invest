// db.js - VERSIÓN FINAL PROFESIONAL (SEGURA)
const { Pool } = require('pg');
require('dotenv').config(); // Carga variables si estás en local

// 1. Leemos la URL segura desde el entorno
const connectionString = process.env.DATABASE_URL;

// Validación de seguridad para que no arranque si falta la URL
if (!connectionString) {
    console.error("❌ ERROR FATAL: No se encontró la variable DATABASE_URL.");
    console.error("   -> Si estás en local: Revisa tu archivo .env");
    console.error("   -> Si estás en Render: Revisa la pestaña 'Environment'");
    process.exit(1); // Detiene el servidor para evitar errores raros
}

// 2. Configuración del Pool para NeonDB
const pool = new Pool({
    connectionString: connectionString,
    ssl: true, // Neon requiere SSL activado
});

// Función para ejecutar consultas
async function query(text, params) {
    return pool.query(text, params);
}

// Función de inicialización (Crea tablas si no existen)
async function initDb() {
    console.log("🔌 Conectando a la Base de Datos (Nube)...");
    
    try {
        // Prueba de conexión
        await pool.query('SELECT 1'); 
        console.log("✅ ¡CONEXIÓN EXITOSA!");

        // 1. Tabla Usuarios
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

        console.log("✅ Tablas verificadas y listas.");
        return pool;
    } catch (err) {
        console.error("❌ Error de conexión con la Base de Datos:", err.message);
    }
}

module.exports = { query, initDb };