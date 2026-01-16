const { allQuery, runQuery } = require('../lib/db');

async function migrate() {
    console.log('🚀 Starting Database Migration...');

    try {
        // --- Fix invoice_items table ---
        const invoiceItemCols = await allQuery('PRAGMA table_info(invoice_items)');
        const existingInvoiceItemCols = invoiceItemCols.map(c => c.name);

        const invoiceItemMigrations = [
            { name: 'product_name', type: 'TEXT DEFAULT ""' },
            { name: 'msrp', type: 'REAL DEFAULT 0' },
            { name: 'discount_percentage', type: 'REAL DEFAULT 0' },
            { name: 'discount_amount', type: 'REAL DEFAULT 0' },
            { name: 'is_free', type: 'INTEGER DEFAULT 0' },
            { name: 'line_total', type: 'REAL DEFAULT 0' }
        ];

        for (const col of invoiceItemMigrations) {
            if (!existingInvoiceItemCols.includes(col.name)) {
                console.log(`➕ Adding column ${col.name} to invoice_items`);
                await runQuery(`ALTER TABLE invoice_items ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // --- Fix invoices table ---
        const invoiceCols = await allQuery('PRAGMA table_info(invoices)');
        const existingInvoiceCols = invoiceCols.map(c => c.name);

        const invoiceMigrations = [
            { name: 'bill_discount', type: 'REAL DEFAULT 0' },
            { name: 'tax', type: 'REAL DEFAULT 0' },
            { name: 'payment_details', type: 'TEXT' }
        ];

        for (const col of invoiceMigrations) {
            if (!existingInvoiceCols.includes(col.name)) {
                console.log(`➕ Adding column ${col.name} to invoices`);
                await runQuery(`ALTER TABLE invoices ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

migrate();
