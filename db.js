// db.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Función para abrir la conexión
async function openDb() {
    return open({
        filename: './database.sqlite', // Este será el archivo físico en tu carpeta
        driver: sqlite3.Database
    });
}

// Función para iniciar y crear tablas si no existen
async function initDb() {
    const db = await openDb();
    
    console.log("🔌 Conectando a la Base de Datos...");

    // 1. Crear Tabla de Usuarios
    // Guardamos: ID, Email, Contraseña y Saldo
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT,
            balance REAL DEFAULT 50000
        )
    `);

    // 2. Crear Tabla de Inversiones
    // Guardamos: Quién (userId), Dónde (portfolioId), Cuánto (amount) y Cuándo (date)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS investments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            portfolioId INTEGER,
            amount REAL,
            date TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `);

    console.log("✅ Base de Datos lista y tablas verificadas.");
    return db;
}

module.exports = { openDb, initDb };