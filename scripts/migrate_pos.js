const { getDatabase } = require('../lib/db');

async function migrate() {
    const db = getDatabase();
    console.log('Starting POS migration...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Add status column to invoices
            db.run(`ALTER TABLE invoices ADD COLUMN status TEXT CHECK(status IN ('completed', 'held', 'cancelled')) DEFAULT 'completed'`, (err) => {
                if (err) {
                    if (err.message.includes('duplicate column name')) {
                        console.log('Column "status" already exists.');
                    } else {
                        console.error('Error adding "status" column:', err.message);
                    }
                } else {
                    console.log('Added "status" column to invoices.');
                }
            });

            // Add load_id column to invoices
            db.run(`ALTER TABLE invoices ADD COLUMN load_id INTEGER REFERENCES truck_loads(id)`, (err) => {
                if (err) {
                    if (err.message.includes('duplicate column name')) {
                        console.log('Column "load_id" already exists.');
                    } else {
                        console.error('Error adding "load_id" column:', err.message);
                    }
                } else {
                    console.log('Added "load_id" column to invoices.');
                }
            });

            // Ensure a default Cash Customer exists
            db.get(`SELECT id FROM customers WHERE name = 'Cash Customer' LIMIT 1`, [], (err, row) => {
                if (err) {
                    console.error('Error checking for Cash Customer:', err.message);
                } else if (!row) {
                    db.run(`INSERT INTO customers (name, phone, address, credit_limit, current_balance) VALUES ('Cash Customer', '0000000000', 'Walk-in', 0, 0)`, (err) => {
                        if (err) {
                            console.error('Error creating default Cash Customer:', err.message);
                        } else {
                            console.log('Created default "Cash Customer".');
                        }
                    });
                } else {
                    console.log('Default "Cash Customer" already exists.');
                }
            });

            resolve();
        });
    });
}

migrate()
    .then(() => {
        console.log('Migration completed.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
