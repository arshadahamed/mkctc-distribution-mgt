const { allQuery } = require('./lib/db');

(async () => {
    try {
        const tables = await allQuery("SELECT * FROM sqlite_master WHERE name = 'unload_items'");
        console.log(JSON.stringify(tables, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
