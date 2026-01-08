const db = require('../lib/db');

async function run() {
    try {
        const tables = await db.allQuery("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables:', tables.map(t => t.name));

        const triggers = await db.allQuery("SELECT name, sql FROM sqlite_master WHERE type='trigger'");
        console.log('Triggers:', triggers);

        const schemas = await db.allQuery("SELECT name, sql FROM sqlite_master WHERE name IN ('products', 'invoices', 'invoice_items', 'invoice_items_old', 'invoices_old')");
        console.log('Schemas:', schemas);
        const queries = [
            'DELETE FROM cheque_details',
            'DELETE FROM receipt_allocations',
            'DELETE FROM receipts',
            'DELETE FROM shop_visits',
            'DELETE FROM invoice_items',
            'DELETE FROM invoices',
            'DELETE FROM customers'
        ];

        for (const q of queries) {
            try {
                await db.runQuery(q);
                console.log(`Successfully ran: ${q}`);
            } catch (err) {
                console.error(`Failed to run: ${q} - ${err.message}`);
            }
        }

        console.log('Adding is_deleted column to customers...');
        try {
            await db.runQuery('ALTER TABLE customers ADD COLUMN is_deleted INTEGER DEFAULT 0');
            console.log('Added column is_deleted to customers');
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column is_deleted already exists');
            } else {
                console.error('Error adding column:', err.message);
            }
        }

        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

run();
