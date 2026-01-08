const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) throw err;

    const allRefs = {};

    let processed = 0;
    tables.forEach(table => {
        db.all(`PRAGMA foreign_key_list(${table.name})`, [], (err, fks) => {
            if (err) throw err;
            fks.forEach(fk => {
                if (!allRefs[fk.table]) allRefs[fk.table] = [];
                allRefs[fk.table].push({
                    fromTable: table.name,
                    fromColumn: fk.from,
                    toColumn: fk.to,
                    onDelete: fk.on_delete
                });
            });
            processed++;
            if (processed === tables.length) {
                printRefs();
            }
        });
    });

    function printRefs() {
        ['truck_loads', 'truck_unloads', 'load_items', 'unload_items'].forEach(t => {
            console.log(`\nReferences to ${t}:`);
            if (allRefs[t]) {
                allRefs[t].forEach(r => console.log(`  - From ${r.fromTable}(${r.fromColumn}) -> ${r.toColumn} (ON DELETE ${r.onDelete})`));
            } else {
                console.log('  - None found');
            }
        });
        db.close();
    }
});
