const { allQuery } = require('./lib/db');

(async () => {
    try {
        console.log('Products:', JSON.stringify(await allQuery("SELECT id, name FROM products LIMIT 5"), null, 2));
    } catch (e) {
        console.error(e);
    }
})();
