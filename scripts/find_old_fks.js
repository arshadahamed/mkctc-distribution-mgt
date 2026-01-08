const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) throw err;

    tables.forEach(table => {
        db.all(`PRAGMA foreign_key_list(${table.name})`, [], (err, fks) => {
            if (err) throw err;
            fks.forEach(fk => {
                if (fk.table.includes('old')) {
                    console.log(`Table ${table.name} has FK to ${fk.table}`);
                }
            });
        });
    });

    setTimeout(() => db.close(), 1000);
});
