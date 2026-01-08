const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('agro_distribution.db');

db.serialize(() => {
    db.all("PRAGMA table_info(app_settings)", [], (err, info) => {
        console.log('app_settings info:', info);
        db.close();
    });
});
