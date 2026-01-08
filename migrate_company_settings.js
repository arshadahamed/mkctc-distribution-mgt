const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Creating company_settings table...');

db.serialize(() => {
    // Create company_settings table
    db.run(`
        CREATE TABLE IF NOT EXISTS company_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            company_name TEXT DEFAULT 'Distribution System',
            address TEXT,
            contact_numbers TEXT,
            logo_url TEXT,
            favicon_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating company_settings table:', err);
        } else {
            console.log('✓ company_settings table created/verified');
        }
    });

    // Insert default record if table is empty
    db.get('SELECT COUNT(*) as count FROM company_settings', (err, row) => {
        if (err) {
            console.error('Error checking company_settings:', err);
            db.close();
        } else if (row.count === 0) {
            db.run(`
                INSERT INTO company_settings (id, company_name, address, contact_numbers, logo_url, favicon_url)
                VALUES (1, 'Distribution System', '', '', '', '')
            `, (err) => {
                if (err) {
                    console.error('Error inserting default company settings:', err);
                } else {
                    console.log('✓ Default company settings record created');
                }
                db.close(() => {
                    console.log('Migration completed!');
                });
            });
        } else {
            console.log('✓ Company settings record already exists');
            db.close(() => {
                console.log('Migration completed!');
            });
        }
    });
});
