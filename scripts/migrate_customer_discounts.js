const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Adding Customer Product Discounts table...');

    db.run(`CREATE TABLE IF NOT EXISTS customer_product_discounts (
        customer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        discount_percentage REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_id, product_id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    console.log('Customer Product Discounts table created successfully.');
});

db.close();
