const { allQuery } = require('../lib/db');
const posRepo = require('../repositories/posRepo');

async function testFetch() {
    console.log('--- Debug: Frontend Load Simulation ---');
    try {
        // 1. Get Active Loads
        const loads = await posRepo.getActiveLoads();
        console.log('Active Loads:', loads.map(l => ({ id: l.id, vehicle: l.vehicle_number })));

        if (loads.length === 0) {
            console.log('No active loads found. Cannot test stock.');
            return;
        }

        const targetLoadId = loads[0].id; // Use first active load
        console.log(`Testing Stock for Load ID: ${targetLoadId}`);

        // 2. Get Stock for this load
        const stock = await posRepo.getTruckStock(targetLoadId);
        console.log(`Found ${stock.length} products.`);
        if (stock.length > 0) {
            console.log('First 3 Products:', stock.slice(0, 3));
        } else {
            console.log('No products in this load? Checking load items directly...');
            const items = await allQuery('SELECT * FROM load_items WHERE load_id = ?', [targetLoadId]);
            console.log('Raw Load Items:', items);
        }

    } catch (e) {
        console.error('Simulation Failed:', e);
    }
}

testFetch();
