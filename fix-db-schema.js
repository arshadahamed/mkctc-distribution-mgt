const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking invoices table schema...');

db.all("PRAGMA table_info(invoices)", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    const hasPaymentMethod = rows.some(r => r.name === 'payment_method');

    if (!hasPaymentMethod) {
        console.log('Column payment_method missing. Adding it...');
        db.run("ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'cash'", (err) => {
            if (err) console.error('Error adding payment_method:', err.message);
            else console.log('Column payment_method added successfully');
            db.close();
        });
    } else {
        console.log('Column payment_method already exists.');
        db.close();
    }
});
