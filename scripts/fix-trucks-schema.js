const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🚚 Fixing Trucks Table Schema...');

db.serialize(() => {
    // Columns that might be missing
    const columns = [
        { name: 'vehicle_type', type: 'TEXT' },
        { name: 'fuel_type', type: 'TEXT' },
        { name: 'vehicle_image', type: 'TEXT' }
    ];

    columns.forEach(col => {
        db.run(`ALTER TABLE trucks ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`ℹ️  Column '${col.name}' already exists.`);
                } else {
                    console.error(`❌ Error adding '${col.name}':`, err.message);
                }
            } else {
                console.log(`✅ Column '${col.name}' added successfully.`);
            }
        });
    });
});

setTimeout(() => {
    db.close();
    console.log('🏁 Schema fix complete.');
}, 2000);
