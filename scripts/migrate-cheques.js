const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Starting Cheque Details Migration...');

db.serialize(() => {
    // Add status column if it doesn't exist
    db.run("ALTER TABLE cheque_details ADD COLUMN status TEXT DEFAULT 'Pending'", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ status column already exists.');
            } else {
                console.error('❌ Error adding status column:', err.message);
            }
        } else {
            console.log('✅ status column added successfully.');
        }
    });

    // Add remarks column if it doesn't exist
    db.run("ALTER TABLE cheque_details ADD COLUMN remarks TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ remarks column already exists.');
            } else {
                console.error('❌ Error adding remarks column:', err.message);
            }
        } else {
            console.log('✅ remarks column added successfully.');
        }
    });
});

setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('🏁 Migration finished.');
    });
}, 2000);
