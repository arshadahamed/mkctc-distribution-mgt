const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Checking for Broken Foreign Keys ---');
db.all("PRAGMA foreign_key_check", [], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) {
        console.log('No broken foreign keys found.');
    } else {
        console.log('Broken foreign keys:', rows);
    }
});

console.log('\n--- Checking Table References ---');
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) throw err;

    tables.forEach(table => {
        db.all(`PRAGMA foreign_key_list(${table.name})`, [], (err, fks) => {
            if (err) throw err;
            if (fks.length > 0) {
                const refsLoads = fks.filter(fk => fk.table === 'truck_loads');
                if (refsLoads.length > 0) {
                    console.log(`Table ${table.name} references truck_loads:`, refsLoads);
                }
            }
        });
    });
});

setTimeout(() => db.close(), 2000);
