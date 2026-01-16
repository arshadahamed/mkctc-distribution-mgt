const { allQuery } = require('./lib/db');

async function testSubquery() {
    try {
        const sql = `
            SELECT tl.id, tl.status,
            (SELECT COUNT(*) FROM load_items WHERE load_id = tl.id) as item_count,
            (SELECT SUM(quantity_loaded) FROM load_items WHERE load_id = tl.id) as total_qty
            FROM truck_loads tl
        `;
        const results = await allQuery(sql);
        console.log('Query Results:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Query Error:', err);
    }
}

testSubquery();
