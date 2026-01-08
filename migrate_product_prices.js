const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Create product_prices table
    db.run(`
        CREATE TABLE IF NOT EXISTS product_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            price REAL NOT NULL,
            is_primary INTEGER DEFAULT 0,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating product_prices table:', err.message);
        } else {
            console.log('✅ product_prices table created or already exists.');

            // Migrate existing msrp prices if table is empty
            db.get("SELECT COUNT(*) as count FROM product_prices", (err, row) => {
                if (row && row.count === 0) {
                    console.log('Migrating existing MSRPs to product_prices...');
                    db.run(`
                        INSERT INTO product_prices (product_id, label, price, is_primary)
                        SELECT id, 'MSRP', msrp, 1 FROM products WHERE msrp IS NOT NULL
                    `, (err) => {
                        if (err) console.error('Migration error:', err.message);
                        else console.log('✅ Existing MSRPs migrated successfully.');
                    });
                }
            });
        }
    });
});

setTimeout(() => db.close(), 2000);
