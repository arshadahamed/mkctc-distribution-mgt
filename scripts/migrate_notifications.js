const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Add email column to customers table if it doesn't exist
    db.all("PRAGMA table_info(customers)", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        const hasEmail = rows.some(row => row.name === 'email');
        if (!hasEmail) {
            db.run("ALTER TABLE customers ADD COLUMN email TEXT", (err) => {
                if (err) console.error('Error adding email column:', err);
                else console.log('✅ Added email column to customers table');
            });
        } else {
            console.log('ℹ️ Email column already exists in customers table');
        }
    });

    // Add notification settings to app_settings if they don't exist
    const settings = [
        { key: 'email_enabled', value: 'false' },
        { key: 'email_host', value: '' },
        { key: 'email_port', value: '587' },
        { key: 'email_user', value: '' },
        { key: 'email_pass', value: '' },
        { key: 'email_from', value: '' },
        { key: 'sms_enabled', value: 'false' },
        { key: 'sms_provider', value: 'textbelt' }, // textbelt, twilio, etc.
        { key: 'sms_api_key', value: '' },
        { key: 'sms_sender_id', value: 'MKC' }
    ];

    settings.forEach(s => {
        db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", [s.key, s.value]);
    });

    console.log('✅ Notification settings initialized');
});
