const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('Tables:');
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) throw err;
    rows.forEach(r => console.log(`'${r.name}'`));
    db.close();
});
