const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, load_date, status FROM truck_loads", [], (err, rows) => {
    if (err) throw err;
    console.log(rows);
    db.close();
});
