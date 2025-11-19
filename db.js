// db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ ERROR FATAL: No se encontró la variable DATABASE_URL.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: true,
    family: 4, // Fuerza IPv4
    connectionTimeoutMillis: 20000, // <--- NUEVO: Esperar máx 5 segundos
});

async function query(text, params) {
    return pool.query(text, params);
}

async function initDb() {
    console.log("⏳ Intentando conectar a NeonDB (Espere 5 seg)...");
    
    try {
        // Prueba de conexión
        await pool.query('SELECT 1'); 
        console.log("✅ ¡CONEXIÓN EXITOSA A LA BASE DE DATOS!");

        // Si llega aquí, crea las tablas...
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                balance DECIMAL(15, 2) DEFAULT 50000
            )
        `);
        // ... (El resto de tablas se omiten por brevedad, ya deben estar creadas) ...
        
        return pool;
    } catch (err) {
        console.error("------------------------------------------------");
        console.error("❌ ERROR DE CONEXIÓN DETECTADO:");
        console.error(err.message);
        console.error("------------------------------------------------");
        console.error("💡 POSIBLE SOLUCIÓN: Tu internet está bloqueando el puerto 5432.");
        console.error("   Intenta compartir internet desde tu celular (Datos Móviles)");
        console.error("   para descartar un bloqueo de tu WiFi.");
        process.exit(1); // Matar el proceso si falla la BD
    }
}

module.exports = { query, initDb };