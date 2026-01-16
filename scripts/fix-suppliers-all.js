const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

const expectedColumns = [
    { name: 'address', type: 'TEXT' },
    { name: 'contact', type: 'TEXT' },
    { name: 'category', type: 'TEXT' },
    { name: 'tags', type: 'TEXT' },
    { name: 'tsr_name', type: 'TEXT' },
    { name: 'area_manager_name', type: 'TEXT' }
];

db.all("PRAGMA table_info(suppliers)", (err, columns) => {
    if (err) {
        console.error('Error getting columns:', err);
        process.exit(1);
    }

    const existingColumnNames = columns.map(col => col.name);

    db.serialize(() => {
        expectedColumns.forEach(expected => {
            if (!existingColumnNames.includes(expected.name)) {
                console.log(`⚠️  Column "${expected.name}" is missing. Adding it...`);
                db.run(`ALTER TABLE suppliers ADD COLUMN ${expected.name} ${expected.type}`, (err) => {
                    if (err) console.error(`❌ Error adding ${expected.name}:`, err);
                    else console.log(`✅ Column "${expected.name}" added.`);
                });
            }
        });
    });

    setTimeout(() => {
        console.log('🏁 Check complete.');
        db.close();
    }, 2000);
});
