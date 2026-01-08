const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(products)", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    const hasWeighted = rows.some(r => r.name === 'weighted');
    console.log('Has weighted column:', hasWeighted);
    if (!hasWeighted) {
        console.log('Adding weighted column...');
        db.run("ALTER TABLE products ADD COLUMN weighted BOOLEAN DEFAULT 0", (err) => {
            if (err) console.error(err);
            else console.log('Column added successfully.');
        });
    }
});
