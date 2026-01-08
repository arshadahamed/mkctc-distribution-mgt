const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking foreign key dependencies for truck_loads...\n');

db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) throw err;

    tables.forEach(table => {
        if (table.sql.includes('truck_loads') || table.sql.includes('load_id')) {
            console.log(`Table: ${table.name}`);
            console.log(`SQL: ${table.sql}\n`);
        }
    });

    db.close();
});
