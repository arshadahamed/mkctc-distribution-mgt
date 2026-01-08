const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

const name = process.argv[2];
db.get(`SELECT sql FROM sqlite_master WHERE name='${name}'`, [], (err, row) => {
    if (err) throw err;
    console.log(row ? row.sql : 'Not found');
    db.close();
});
