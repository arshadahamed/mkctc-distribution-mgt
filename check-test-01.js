const { allQuery } = require('./lib/db');

async function checkTest01() {
    try {
        const sql = `
            SELECT tl.id, t.registration_number,
            (SELECT COUNT(*) FROM load_items li WHERE li.load_id = tl.id) as item_count,
            (SELECT SUM(li.quantity_loaded) FROM load_items li WHERE li.load_id = tl.id) as total_qty
            FROM truck_loads tl
            JOIN trucks t ON tl.truck_id = t.id
            WHERE t.registration_number = 'TEST-01'
        `;
        const res = await allQuery(sql);
        console.log('Results for TEST-01:', res);
    } catch (err) {
        console.error(err);
    }
}

checkTest01();
