const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

function resetConnection() {
    if (db) {
        const oldDb = db;
        db = null;
        try { oldDb.close(); } catch (e) { }
    }
}

function getDatabase() {
    if (!db) {
        const currentDbPath = process.env.DB_PATH || path.join(__dirname, '..', 'agro_distribution.db');
        console.log('🗄️  Opening Database at:', path.resolve(currentDbPath));
        db = new sqlite3.Database(currentDbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                // Integrity
                db.run('PRAGMA foreign_keys = ON');
                db.run('PRAGMA journal_mode = WAL');
                // Performance (all safe with WAL):
                //  - NORMAL sync: durable under WAL, far fewer fsyncs than FULL
                //  - temp tables/sorts in RAM instead of disk
                //  - larger page cache (~16 MB) to keep hot indexes resident
                //  - wait up to 5s on a locked db instead of throwing SQLITE_BUSY
                //  - auto-checkpoint every 1000 WAL pages so the WAL can't balloon
                db.run('PRAGMA synchronous = NORMAL');
                db.run('PRAGMA temp_store = MEMORY');
                db.run('PRAGMA cache_size = -16000');
                db.run('PRAGMA busy_timeout = 5000');
                db.run('PRAGMA wal_autocheckpoint = 1000');
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

// Checkpoint + truncate the WAL. Safe to call periodically; keeps the
// -wal file from growing unbounded between auto-checkpoints.
function walCheckpoint() {
    return new Promise((resolve) => {
        const database = getDatabase();
        database.get('PRAGMA wal_checkpoint(TRUNCATE)', (err, row) => {
            if (err) { console.error('WAL checkpoint failed:', err.message); resolve(null); }
            else resolve(row);
        });
    });
}

module.exports = { getDatabase, runQuery, getQuery, allQuery, transaction, resetConnection, walCheckpoint };
