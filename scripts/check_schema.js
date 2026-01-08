const db = require('../lib/db');
async function run() {
    const schemas = await db.allQuery("SELECT sql FROM sqlite_master WHERE name IN ('shop_visits', 'audit_logs')");
    schemas.forEach(s => console.log(s.sql));
    process.exit(0);
}
run();
