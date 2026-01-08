const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Updating Database Schema for Cheques...\n');

db.serialize(() => {
    // Add status column to cheque_details if it doesn't exist
    db.run("ALTER TABLE cheque_details ADD COLUMN status TEXT DEFAULT 'Pending'", (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log('ℹ️  Column "status" already exists in cheque_details.');
            } else {
                console.error('❌ Error adding column:', err.message);
            }
        } else {
            console.log('✅ Added "status" column to cheque_details table.');
        }
    });

    // Add note/remarks column to cheque_details for return reasons etc
    db.run("ALTER TABLE cheque_details ADD COLUMN remarks TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log('ℹ️  Column "remarks" already exists in cheque_details.');
            } else {
                console.error('❌ Error adding column:', err.message);
            }
        } else {
            console.log('✅ Added "remarks" column to cheque_details table.');
        }
    });
});

db.close(() => {
    console.log('\n🏁 Schema update check complete.');
});
