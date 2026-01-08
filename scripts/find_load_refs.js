const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) throw err;

    const checkTable = (index) => {
        if (index >= tables.length) {
            db.close();
            return;
        }

        const tableName = tables[index].name;
        db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
            if (err) throw err;

            const relevantCols = columns.filter(c => c.name.toLowerCase().includes('load'));
            if (relevantCols.length > 0) {
                console.log(`Table: ${tableName}`);
                relevantCols.forEach(c => console.log(`  - Column: ${c.name}`));
            }
            checkTable(index + 1);
        });
    };

    checkTable(0);
});
