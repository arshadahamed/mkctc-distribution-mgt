const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('agro_distribution.db');

db.serialize(() => {
    db.run("ALTER TABLE company_settings ADD COLUMN invoice_template TEXT DEFAULT 'classic'", (err) => {
        if (err && err.message.includes('duplicate column name')) {
            console.log('Column invoice_template already exists');
        } else if (err) {
            console.error('Error adding column:', err);
        } else {
            console.log('Column invoice_template added successfully');
        }
        db.close();
    });
});
