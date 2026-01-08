const { runQuery } = require('../lib/db');

async function migrate() {
    try {
        console.log('Starting migration: adding receipt_category to receipts...');

        // Check if column exists
        const tableInfo = await new Promise((resolve, reject) => {
            const { getDatabase } = require('../lib/db');
            const db = getDatabase();
            db.all('PRAGMA table_info(receipts)', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const hasCategory = tableInfo.some(col => col.name === 'receipt_category');

        if (!hasCategory) {
            await runQuery("ALTER TABLE receipts ADD COLUMN receipt_category TEXT CHECK(receipt_category IN ('collection', 'return')) DEFAULT 'collection'");
            console.log('✅ Column receipt_category added to receipts.');
        } else {
            console.log('ℹ️ Column receipt_category already exists.');
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
