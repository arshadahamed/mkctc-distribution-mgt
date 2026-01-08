const db = require('../lib/db');
async function run() {
    try {
        const results = await db.allQuery("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%products_old%'");
        console.log('--- TABLES REFERENCING products_old ---');
        for (const r of results) {
            console.log(`Table: ${r.name}`);
            console.log(r.sql);
            console.log('----------------');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
