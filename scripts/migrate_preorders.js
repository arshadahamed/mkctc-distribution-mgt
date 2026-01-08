const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Adding Pre-Orders tables...');

    db.run(`CREATE TABLE IF NOT EXISTS pre_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        order_date DATE NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT CHECK(status IN ('pending', 'converted', 'cancelled')) DEFAULT 'pending',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pre_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pre_order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY (pre_order_id) REFERENCES pre_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    console.log('Pre-Orders tables created successfully.');
});

db.close();
