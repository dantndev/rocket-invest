// db.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function openDb() {
    return open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });
}

async function initDb() {
    const db = await openDb();
    
    console.log("🔌 Conectando a la Base de Datos...");

    // 1. Usuarios
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT,
            balance REAL DEFAULT 50000
        )
    `);

    // 2. Inversiones Activas (Portafolio)
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

    // 3. [NUEVO] Historial de Transacciones (Logs)
    // Tipos: 'deposit', 'withdraw', 'invest', 'sell'
    await db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            type TEXT, 
            description TEXT,
            amount REAL,
            date TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `);

    console.log("✅ Base de Datos lista y tablas verificadas.");
    return db;
}

module.exports = { openDb, initDb };