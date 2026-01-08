
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('Using DB:', dbPath);

db.serialize(() => {
    // 1. Create company_settings
    db.run(`CREATE TABLE IF NOT EXISTS company_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL DEFAULT 'M.K.C. TRADE CENTER',
        address TEXT DEFAULT '',
        logo_url TEXT DEFAULT '',
        favicon_url TEXT DEFAULT '',
        contact_numbers TEXT DEFAULT '',
        invoice_template TEXT DEFAULT 'classic',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating company_settings:', err.message);
        else console.log('✅ company_settings table checked/created');
    });

    // 2. Insert default company/settings row if empty
    db.run(`INSERT OR IGNORE INTO company_settings (id, company_name, address, invoice_template) 
            VALUES (1, 'M.K.C. TRADE CENTER', '123 Main St', 'classic')`, (err) => {
        if (err) console.error('Error inserting default company settings:', err.message);
        else console.log('✅ Default company settings row ensured');
    });

    // 3. Create app_settings
    db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating app_settings:', err.message);
        else console.log('✅ app_settings table checked/created');
    });

    // 4. Insert default session timer setting
    // Key: admin_session_timeout_enabled, Value: true/false (JSON)
    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('admin_session_timeout', '{"enabled":true,"duration":600}')`, (err) => {
        if (err) console.error('Error inserting default app settings:', err.message);
        else console.log('✅ Default app settings ensured');
    });
});

db.close();
