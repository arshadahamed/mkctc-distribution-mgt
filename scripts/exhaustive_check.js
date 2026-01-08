const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Triggers ---');
db.all("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'", [], (err, rows) => {
    if (err) throw err;
    console.log(rows);
});

console.log('--- Views ---');
db.all("SELECT name, sql FROM sqlite_master WHERE type='view'", [], (err, rows) => {
    if (err) throw err;
    console.log(rows);
});

console.log('--- Indexes with issues? ---');
// Sometimes corrupted indexes cause weird table errors
db.all("PRAGMA integrity_check", [], (err, rows) => {
    if (err) throw err;
    console.log('Integrity:', rows);
});

setTimeout(() => db.close(), 2000);
