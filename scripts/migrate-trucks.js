const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🚚 Migrating Trucks Table...');

db.serialize(() => {
    db.run("ALTER TABLE trucks ADD COLUMN model TEXT", (err) => {
        if (!err) console.log('✅ model column added');
    });
    db.run("ALTER TABLE trucks ADD COLUMN capacity TEXT", (err) => {
        if (!err) console.log('✅ capacity column added');
    });
    db.run("ALTER TABLE trucks ADD COLUMN current_location TEXT DEFAULT 'Warehouse'", (err) => {
        if (!err) console.log('✅ current_location column added');
    });
});

setTimeout(() => {
    db.close();
    console.log('🏁 Migration complete');
}, 2000);
