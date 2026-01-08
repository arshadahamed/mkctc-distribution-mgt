const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

async function check() {
    console.log('--- Foreign Key List for truck_loads ---');
    db.all("PRAGMA foreign_key_list(truck_loads)", [], (err, rows) => {
        console.log(rows);
    });

    console.log('--- Finding tables that reference truck_loads ---');
    db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        tables.forEach(t => {
            if (t.sql && t.sql.includes('REFERENCES truck_loads')) {
                console.log(`Table ${t.name} references truck_loads:`);
                console.log(t.sql);
            }
        });
    });
}

check();
