const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

const columnsToAdd = [
    { name: 'units_per_carton', type: 'INTEGER DEFAULT 1' },
    { name: 'product_image', type: 'TEXT' },
    { name: 'tags', type: 'TEXT' },
    { name: 'chemical_name', type: 'TEXT' },
    { name: 'initial_stock', type: 'REAL DEFAULT 0' }
];

db.serialize(() => {
    // Check existing columns
    db.all("PRAGMA table_info(products)", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }

        const existingColumns = rows.map(r => r.name);

        columnsToAdd.forEach(column => {
            if (!existingColumns.includes(column.name)) {
                console.log(`Adding column ${column.name}...`);
                db.run(`ALTER TABLE products ADD COLUMN ${column.name} ${column.type}`, (err) => {
                    if (err) {
                        console.error(`Error adding column ${column.name}:`, err.message);
                    } else {
                        console.log(`✅ Column ${column.name} added successfully.`);
                    }
                });
            } else {
                console.log(`Column ${column.name} already exists.`);
            }
        });
    });
});
