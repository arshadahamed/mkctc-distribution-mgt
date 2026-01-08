const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Latest Audit Logs ---');
db.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10", [], (err, rows) => {
    if (err) throw err;
    console.log(rows);
    db.close();
});
