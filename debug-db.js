const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('Tables in DB:');
db.each("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
    console.log(' - ' + row.name);
}, (err, count) => {
    console.log('Total tables:', count);

    console.log('\nChecking app_settings content:');
    db.all("SELECT * FROM app_settings", (err, rows) => {
        if (err) console.error('Error reading app_settings:', err.message);
        else console.log('app_settings rows:', rows);

        db.close();
    });
});
