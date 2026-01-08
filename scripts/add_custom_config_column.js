
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('Using DB:', dbPath);

db.serialize(() => {
    // Add invoice_custom_config column
    db.run(`ALTER TABLE company_settings ADD COLUMN invoice_custom_config TEXT DEFAULT '{}'`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('ℹ️ Column invoice_custom_config already exists.');
            } else {
                console.error('❌ Error adding column:', err.message);
            }
        } else {
            console.log('✅ Column invoice_custom_config added successfully.');
        }
    });
});

db.close();
