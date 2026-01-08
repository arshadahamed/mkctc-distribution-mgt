const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('agro_distribution.db');

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Tables:', tables.map(t => t.name));

        if (tables.some(t => t.name === 'company_settings')) {
            db.all("PRAGMA table_info(company_settings)", [], (err, info) => {
                console.log('company_settings info:', info);
                db.close();
            });
        } else {
            console.log('company_settings table NOT found');
            db.close();
        }
    });
});
