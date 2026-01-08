const { allQuery } = require('./lib/db');

(async () => {
    try {
        console.log('Trucks:', JSON.stringify(await allQuery("SELECT * FROM trucks"), null, 2));
    } catch (e) {
        console.error(e);
    }
})();
