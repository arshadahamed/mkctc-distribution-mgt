const db = require('../lib/db');
async function run() {
    try {
        const tables = ['load_items', 'unload_items', 'invoice_items'];
        for (const t of tables) {
            const res = await db.getQuery("SELECT sql FROM sqlite_master WHERE name=?", [t]);
            console.log(`--- ${t} ---`);
            console.log(res.sql);
            console.log('----------------');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
