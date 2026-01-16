const { allQuery } = require('./lib/db');

async function checkLoads() {
    try {
        const loads = await allQuery('SELECT id, registration_number FROM truck_loads tl JOIN trucks t ON tl.truck_id = t.id');
        console.log('Truck Loads:', loads);

        for (const load of loads) {
            const items = await allQuery('SELECT * FROM load_items WHERE load_id = ?', [load.id]);
            console.log(`Load ${load.id} (${load.registration_number}) Items:`, items);
        }
    } catch (err) {
        console.error(err);
    }
}

checkLoads();
