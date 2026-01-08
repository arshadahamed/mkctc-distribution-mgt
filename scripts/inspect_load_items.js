const db = require('../lib/db');
async function run() {
    try {
        const res = await db.getQuery("SELECT sql FROM sqlite_master WHERE name='load_items'");
        console.log(res.sql);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
