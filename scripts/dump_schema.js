const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL", [], (err, rows) => {
    if (err) throw err;
    rows.forEach(r => console.log(r.sql + ';\n'));
    db.close();
});
