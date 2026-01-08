const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('📦 Initializing RMA (Damage & Returns) Schema...');

db.serialize(() => {
    // 1. Create RMA Requests Table
    db.run(`CREATE TABLE IF NOT EXISTS rma_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rma_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        invoice_id INTEGER, -- Optional link to original invoice
        load_id INTEGER, -- Optional link to truck load (if return collected by truck)
        request_date DATE NOT NULL,
        status TEXT CHECK(status IN ('pending', 'inspected', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
        total_value REAL DEFAULT 0,
        remarks TEXT,
        handled_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (load_id) REFERENCES truck_loads(id),
        FOREIGN KEY (handled_by) REFERENCES users(id)
    )`);

    // 2. Create RMA Items Table
    db.run(`CREATE TABLE IF NOT EXISTS rma_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rma_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        reason TEXT NOT NULL, -- Damaged, Expired, Wrong Item, etc.
        condition TEXT CHECK(condition IN ('sellable', 'damaged', 'expired')) DEFAULT 'damaged',
        action_taken TEXT CHECK(action_taken IN ('none', 'restocked', 'scrapped', 'returned_to_supplier')) DEFAULT 'none',
        FOREIGN KEY (rma_id) REFERENCES rma_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // 3. Create Damaged Stock Ledger (for tracking losses)
    db.run(`CREATE TABLE IF NOT EXISTS damaged_stock_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        rma_item_id INTEGER,
        quantity REAL NOT NULL,
        type TEXT CHECK(type IN ('damage', 'expiry', 'scrap')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (rma_item_id) REFERENCES rma_items(id)
    )`);

    // Create indexes for performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_rma_customer ON rma_requests(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rma_invoice ON rma_requests(invoice_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rma_status ON rma_requests(status)`);

    console.log('✅ RMA tables created successfully');
});

db.close();
