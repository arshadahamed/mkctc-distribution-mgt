const db = require('../lib/db');
async function run() {
    try {
        const results = await db.allQuery("SELECT type, name, sql FROM sqlite_master WHERE sql LIKE '%products_old%'");
        console.log('--- REFERENCES TO products_old ---');
        results.forEach(r => {
            console.log(`Type: ${r.type}, Name: ${r.name}`);
            console.log(r.sql);
            console.log('----------------');
        });

        if (results.length === 0) {
            console.log('No direct references found in sqlite_master.');
        }

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
