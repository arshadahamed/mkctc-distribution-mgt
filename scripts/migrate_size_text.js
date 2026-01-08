const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Add size column if it doesn't exist
    db.run("ALTER TABLE products ADD COLUMN size TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column "size" already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Column "size" added successfully.');

            // Migrate data from sizes table if size_id exists
            db.run(`
                UPDATE products 
                SET size = (SELECT name FROM sizes WHERE sizes.id = products.size_id)
                WHERE size_id IS NOT NULL
            `, (err) => {
                if (err) {
                    console.error('Error migrating size data:', err.message);
                } else {
                    console.log('Size data migrated successfully.');
                }
            });
        }
    });

    // We don't necessarily need to drop sizes table or size_id column yet to avoid breaking stuff
    // But we will stop using them.
    db.close();
});
