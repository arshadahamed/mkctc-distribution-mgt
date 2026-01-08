const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Applying Payment Method Migration (Enable "split" and "pending")...\n');

db.serialize(() => {
    // 1. Disable Foreign Keys
    db.run('PRAGMA foreign_keys = OFF');
    console.log('1. Foreign keys disabled.');

    // 2. Begin Transaction
    db.run('BEGIN TRANSACTION');

    // 3. Rename old table
    db.run('ALTER TABLE invoices RENAME TO invoices_old');
    console.log('2. Old table renamed.');

    // 4. Create new table with updated CHECK constraint (adding 'split' and 'pending')
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        invoice_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        bill_discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        net_total REAL NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('cash', 'cheque', 'account', 'split', 'pending')) DEFAULT 'cash',
        status TEXT CHECK(status IN ('completed', 'held', 'cancelled')) DEFAULT 'completed',
        load_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (load_id) REFERENCES truck_loads(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`);
    console.log('3. New table created.');

    // 5. Copy data
    db.run(`INSERT INTO invoices (id, invoice_number, invoice_date, customer_id, bill_discount, tax, net_total, payment_method, status, load_id, created_by, created_at)
            SELECT id, invoice_number, invoice_date, customer_id, bill_discount, tax, net_total, payment_method, status, load_id, created_by, created_at
            FROM invoices_old`);
    console.log('4. Data copied.');

    // 6. Drop old table
    db.run('DROP TABLE invoices_old');
    console.log('5. Old table dropped.');

    // 7. Commit
    db.run('COMMIT', (err) => {
        if (err) {
            console.error('❌ Migration failed:', err);
            db.run('ROLLBACK');
        } else {
            console.log('✅ Migration successful!');
        }

        // 8. Re-enable Foreign Keys
        db.run('PRAGMA foreign_keys = ON');
        db.close();
    });
});
