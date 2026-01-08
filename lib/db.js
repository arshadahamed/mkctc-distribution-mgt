const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'agro_distribution.db');

let db = null;

function getDatabase() {
    if (!db) {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('✅ Connected to SQLite database');
                // Enable foreign keys
                db.run('PRAGMA foreign_keys = ON');
                db.run('PRAGMA journal_mode = WAL');
            }
        });
    }
    return db;
}

// Helper function to run queries with promises
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        database.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        database.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        database.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Transaction wrapper
async function transaction(work) {
    const database = getDatabase();
    return new Promise((resolve, reject) => {
        database.serialize(async () => {
            try {
                // Manually implement db.run for transaction commands to ensure they run on the correct instance
                await new Promise((res, rej) => database.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));

                const result = await work();

                await new Promise((res, rej) => database.run('COMMIT', (err) => err ? rej(err) : res()));
                resolve(result);
            } catch (error) {
                await new Promise((res, rej) => database.run('ROLLBACK', (err) => err ? rej(err) : res()));
                reject(error);
            }
        });
    });
}

module.exports = { getDatabase, runQuery, getQuery, allQuery, transaction };
