const db = require('../lib/db');

async function fixTable(tableName, createSql) {
    console.log(`Fixing table: ${tableName}...`);
    try {
        await db.runQuery('PRAGMA foreign_keys = OFF');
        await db.runQuery('BEGIN TRANSACTION');

        const oldTable = `${tableName}_old_backup`;
        // Check if backup already exists (could happen if script failed halfway)
        const checkBackup = await db.getQuery("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [oldTable]);
        if (checkBackup) {
            console.log(`Warning: ${oldTable} already exists. Dropping it.`);
            await db.runQuery(`DROP TABLE ${oldTable}`);
        }

        await db.runQuery(`ALTER TABLE ${tableName} RENAME TO ${oldTable}`);
        await db.runQuery(createSql);

        // Get columns for INSERT (dynamic to avoid mistakes)
        const columnsInfo = await db.allQuery(`PRAGMA table_info(${oldTable})`);
        const columns = columnsInfo.map(c => c.name).join(', ');

        await db.runQuery(`INSERT INTO ${tableName} (${columns}) SELECT ${columns} FROM ${oldTable}`);
        await db.runQuery(`DROP TABLE ${oldTable}`);

        await db.runQuery('COMMIT');
        console.log(`✅ Table ${tableName} fixed successfully.`);
    } catch (err) {
        await db.runQuery('ROLLBACK');
        console.error(`❌ Error fixing table ${tableName}:`, err);
        throw err;
    } finally {
        await db.runQuery('PRAGMA foreign_keys = ON');
    }
}

async function run() {
    try {
        // Fix truck_unloads
        const truckUnloadsSql = `
            CREATE TABLE truck_unloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unload_date DATE NOT NULL,
                load_id INTEGER NOT NULL,
                truck_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (load_id) REFERENCES truck_loads(id) ON DELETE CASCADE,
                FOREIGN KEY (truck_id) REFERENCES trucks(id)
            )
        `;
        await fixTable('truck_unloads', truckUnloadsSql);

        // Fix load_items
        const loadItemsSql = `
            CREATE TABLE load_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                load_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity_loaded REAL NOT NULL,
                FOREIGN KEY (load_id) REFERENCES truck_loads(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `;
        await fixTable('load_items', loadItemsSql);

        // Fix unload_items
        const unloadItemsSql = `
            CREATE TABLE unload_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unload_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity_remaining REAL NOT NULL,
                quantity_unloaded REAL NOT NULL,
                variance REAL DEFAULT 0,
                variance_reason TEXT,
                FOREIGN KEY (unload_id) REFERENCES truck_unloads(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `;
        await fixTable('unload_items', unloadItemsSql);

        // Fix invoice_items
        const invoiceItemsSql = `
            CREATE TABLE invoice_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                msrp REAL NOT NULL,
                discount_percentage REAL DEFAULT 0,
                discount_amount REAL DEFAULT 0,
                quantity REAL NOT NULL,
                line_total REAL NOT NULL,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `;
        await fixTable('invoice_items', invoiceItemsSql);

    } catch (e) {
        console.error('Fatal Migration Error:', e);
    }
    process.exit(0);
}

run();
