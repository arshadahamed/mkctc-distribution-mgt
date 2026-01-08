const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('--- ALL BROKEN FOREIGN KEYS ---');
db.all("PRAGMA foreign_key_check", [], (err, rows) => {
    if (err) throw err;
    console.log(rows);
    db.close();
});
