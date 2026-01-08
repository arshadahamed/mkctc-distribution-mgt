const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('--- load_items FKs ---');
db.all("PRAGMA foreign_key_list(load_items)", [], (err, rows) => {
    if (err) throw err;
    console.log(rows);
    db.close();
});
