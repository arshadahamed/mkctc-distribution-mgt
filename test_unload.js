const { transaction, runQuery } = require('./lib/db');

(async () => {
    try {
        await transaction(async () => {
            // 1. Create dummy load with correct truck ID (9)
            const loadRes = await runQuery('INSERT INTO truck_loads (load_date, truck_id, loaded_by, status) VALUES (?, ?, ?, ?)', ['2026-01-01', 9, 1, 'loaded']);
            const loadId = loadRes.lastID;

            // 2. Add Item with Valid Product ID (6)
            await runQuery('INSERT INTO load_items (load_id, product_id, quantity_loaded) VALUES (?, ?, ?)', [loadId, 6, 100]);

            console.log('Created dummy load:', loadId);

            // 3. Unload it
            const unloadRes = await runQuery('INSERT INTO truck_unloads (unload_date, load_id, truck_id) VALUES (?, ?, ?)', ['2026-01-01', loadId, 9]);
            const unloadId = unloadRes.lastID;

            await runQuery('UPDATE truck_loads SET status = ? WHERE id = ?', ['unloaded', loadId]);

            // 4. Insert Unload Item
            const variance = 100 - 0 - 50;

            await runQuery(`
                INSERT INTO unload_items (unload_id, product_id, quantity_remaining, quantity_unloaded, variance, variance_reason)
                VALUES (?, ?, ?, ?, ?, ?)
             `, [unloadId, 6, 50, 50, variance, 'Test Reason']);

            console.log('Unload successful:', unloadId);
        });
    } catch (e) {
        console.error('Test Failed:', e);
    }
})();
