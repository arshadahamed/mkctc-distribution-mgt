
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'agro_distribution.db'));

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Tables:', tables.map(t => t.name).join(', '));

        // Check columns of company_settings if it exists
        if (tables.find(t => t.name === 'company_settings')) {
            db.all("PRAGMA table_info(company_settings)", (err, cols) => {
                console.log('company_settings columns:', cols.map(c => c.name).join(', '));
            });
        } else {
            console.log('company_settings table MISSING');
        }

        // Check columns of app_settings if it exists
        if (tables.find(t => t.name === 'app_settings')) {
            db.all("PRAGMA table_info(app_settings)", (err, cols) => {
                console.log('app_settings columns:', cols.map(c => c.name).join(', '));
            });
        } else {
            console.log('app_settings table MISSING');
        }
    });
});
