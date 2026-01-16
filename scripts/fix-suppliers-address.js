const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking suppliers table schema...');

db.get("PRAGMA table_info(suppliers)", (err, row) => {
    if (err) {
        console.error('Error checking table info:', err);
        process.exit(1);
    }

    db.all("PRAGMA table_info(suppliers)", (err, columns) => {
        if (err) {
            console.error('Error getting columns:', err);
            process.exit(1);
        }

        const hasAddress = columns.some(col => col.name === 'address');

        if (!hasAddress) {
            console.log('⚠️  Column "address" is missing in "suppliers" table. Adding it now...');
            db.run("ALTER TABLE suppliers ADD COLUMN address TEXT", (err) => {
                if (err) {
                    console.error('❌ Error adding address column:', err);
                } else {
                    console.log('✅ Column "address" added successfully to "suppliers" table.');
                }
                db.close();
            });
        } else {
            console.log('✅ Column "address" already exists in "suppliers" table.');
            db.close();
        }
    });
});
