const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('⚠️  STARTING HARD RESET (Preserving Users)...');

db.serialize(() => {
    // Disable FKs to allow arbitrary deletion order
    db.run('PRAGMA foreign_keys = OFF');

    // List of tables to clear
    const tablesToClear = [
        'customer_product_discounts',
        'cheque_details',
        'invoice_items',
        'receipt_allocations',
        'load_items',
        'unload_items',
        'pre_order_items',
        'invoices',
        'receipts',
        'truck_loads',
        'truck_unloads',
        'shop_visits',
        'pre_orders',
        'audit_logs',
        'products',
        'customers',
        'suppliers',
        'routes',
        'trucks',
        'departments',
        'categories',
        'brands',
        'units',
        'sizes'
    ];

    // Try to clear tables (ignore errors if table doesn't exist)
    tablesToClear.forEach(table => {
        db.run(`DELETE FROM ${table}`, (err) => {
            if (err) {
                if (err.message.includes('no such table')) {
                    // ignore
                } else {
                    console.error(`Error clearing ${table}:`, err.message);
                }
            } else {
                console.log(`Cleared ${table}`);
            }
        });
    });

    // Reset sequences for cleared tables
    tablesToClear.forEach(table => {
        db.run(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
    });

    // Re-enable FKs
    db.run('PRAGMA foreign_keys = ON', () => {
        console.log('\n✅  Hard Reset Complete. Users preserved.');
        db.close();
    });
});
