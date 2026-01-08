const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

const columnsToAdd = [
    { name: 'credit_limit', type: 'REAL DEFAULT 0' }
];

db.serialize(() => {
    db.all("PRAGMA table_info(customers)", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }

        const existingColumns = rows.map(r => r.name);

        columnsToAdd.forEach(column => {
            if (!existingColumns.includes(column.name)) {
                console.log(`Adding column ${column.name} to customers...`);
                db.run(`ALTER TABLE customers ADD COLUMN ${column.name} ${column.type}`, (err) => {
                    if (err) {
                        console.error(`Error adding column ${column.name}:`, err.message);
                    } else {
                        console.log(`✅ Column ${column.name} added to customers successfully.`);
                    }
                });
            } else {
                console.log(`Column ${column.name} already exists in customers.`);
            }
        });
    });
});
