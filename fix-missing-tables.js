const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Creating missing tables...');

    db.run(`CREATE TABLE IF NOT EXISTS company_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name TEXT DEFAULT 'Agro Distribution System',
        address TEXT,
        logo_url TEXT,
        favicon_url TEXT,
        contact_numbers TEXT,
        invoice_template TEXT DEFAULT 'classic',
        invoice_custom_config TEXT DEFAULT '{}',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating company_settings:', err.message);
        else console.log('company_settings table ready');
    });

    db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating app_settings:', err.message);
        else console.log('app_settings table ready');
    });

    db.run(`INSERT OR IGNORE INTO company_settings (id, company_name) VALUES (1, 'Agro Distribution System')`);
    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('backup_enabled', 'false')`);

    console.log('Done.');
});

db.close();
