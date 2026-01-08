const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('agro_distribution.db');
db.all('SELECT details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5', (err, rows) => {
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
