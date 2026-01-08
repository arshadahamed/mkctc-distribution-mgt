const db = require('../lib/db');
async function run() {
    try {
        const triggers = await db.allQuery("SELECT name, sql FROM sqlite_master WHERE type='trigger'");
        console.log('--- TRIGGERS ---');
        triggers.forEach(t => {
            console.log(`Trigger: ${t.name}`);
            console.log(t.sql);
            console.log('----------------');
        });

        const foreign_keys = await db.allQuery("PRAGMA foreign_key_list(products)");
        console.log('--- FOREIGN KEYS (products) ---');
        console.log(foreign_keys);

        const tables = await db.allQuery("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('--- TABLES ---');
        console.log(tables.map(t => t.name).join(', '));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
