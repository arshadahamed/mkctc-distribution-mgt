const { transaction, runQuery, allQuery, getQuery } = require('../lib/db');

class DistributionRepository {
    async createLoad(loadData) {
        return await transaction(async () => {
            const sql = 'INSERT INTO truck_loads (load_date, truck_id, loaded_by, status) VALUES (?, ?, ?, ?)';
            const params = [loadData.load_date, loadData.truck_id, loadData.loaded_by, 'loaded'];
            const result = await runQuery(sql, params);
            const loadId = result.lastID;

            for (const item of loadData.items) {
                await runQuery('INSERT INTO load_items (load_id, product_id, quantity_loaded) VALUES (?, ?, ?)',
                    [loadId, item.product_id, item.quantity_loaded]);
            }

            return loadId;
        });
    }

    async updateLoad(id, loadData) {
        return await transaction(async () => {
            const sql = 'UPDATE truck_loads SET load_date = ?, truck_id = ? WHERE id = ?';
            await runQuery(sql, [loadData.load_date, loadData.truck_id, id]);
            await runQuery('DELETE FROM load_items WHERE load_id = ?', [id]);
            for (const item of loadData.items) {
                await runQuery('INSERT INTO load_items (load_id, product_id, quantity_loaded) VALUES (?, ?, ?)',
                    [id, item.product_id, item.quantity_loaded]);
            }
            return true;
        });
    }

    async createUnload(unloadData) {
        return await transaction(async () => {
            // Create unload record
            const unloadSql = 'INSERT INTO truck_unloads (unload_date, load_id, truck_id) VALUES (?, ?, ?)';
            const unloadResult = await runQuery(unloadSql, [unloadData.unload_date, unloadData.load_id, unloadData.truck_id]);
            const unloadId = unloadResult.lastID;

            // Update truck load status
            await runQuery('UPDATE truck_loads SET status = ? WHERE id = ?', ['unloaded', unloadData.load_id]);

            // Track individual items and calculate variance
            for (const item of unloadData.items) {
                // Get sold quantity for this product from this truck today
                const soldQuery = `
                    SELECT COALESCE(SUM(ii.quantity), 0) as total_sold
                    FROM invoice_items ii
                    JOIN invoices i ON ii.invoice_id = i.id
                    WHERE i.invoice_date = ? AND ii.product_id = ?
                `;
                const soldResult = await getQuery(soldQuery, [unloadData.unload_date, item.product_id]);
                const quantitySold = soldResult.total_sold;

                // Get loaded quantity
                const loadedQuery = 'SELECT quantity_loaded FROM load_items WHERE load_id = ? AND product_id = ?';
                const loadedResult = await getQuery(loadedQuery, [unloadData.load_id, item.product_id]);
                const quantityLoaded = loadedResult ? loadedResult.quantity_loaded : 0;

                // Variance = (Loaded) - (Sold) - (Returned/Remaining)
                const variance = quantityLoaded - quantitySold - item.quantity_remaining;

                await runQuery(`
                    INSERT INTO unload_items (unload_id, product_id, quantity_remaining, quantity_unloaded, variance, variance_reason)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [unloadId, item.product_id, item.quantity_remaining, item.quantity_remaining, variance, item.variance_reason]);
            }

            return unloadId;
        });
    }

    async getLoadById(id) {
        const load = await getQuery(`
            SELECT tl.*, t.registration_number, u.name as loaded_by_name
            FROM truck_loads tl
            JOIN trucks t ON tl.truck_id = t.id
            JOIN users u ON tl.loaded_by = u.id
            WHERE tl.id = ?
        `, [id]);

        if (load) {
            load.items = await allQuery(`
                SELECT li.*, p.name as product_name, p.unit
                FROM load_items li
                JOIN products p ON li.product_id = p.id
                WHERE li.load_id = ?
            `, [id]);
        }
        return load;
    }

    async getUnloadById(id) {
        const unload = await getQuery(`
            SELECT tu.*, t.registration_number, tl.load_date
            FROM truck_unloads tu
            JOIN trucks t ON tu.truck_id = t.id
            JOIN truck_loads tl ON tu.load_id = tl.id
            WHERE tu.id = ?
        `, [id]);

        if (unload) {
            unload.items = await allQuery(`
                SELECT ui.*, p.name as product_name, p.unit
                FROM unload_items ui
                JOIN products p ON ui.product_id = p.id
                WHERE ui.unload_id = ?
            `, [id]);
        }
        return unload;
    }

    async getActiveLoads(filters = {}) {
        let sql = `
            SELECT tl.*, t.registration_number, t.driver_name, u.name as loaded_by_name
            FROM truck_loads tl
            JOIN trucks t ON tl.truck_id = t.id
            JOIN users u ON tl.loaded_by = u.id
            WHERE tl.status = 'loaded'
        `;
        const params = [];

        if (filters.search) {
            sql += ` AND (t.registration_number LIKE ? OR t.driver_name LIKE ?)`;
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.fromDate) {
            sql += ` AND tl.load_date >= ?`;
            params.push(filters.fromDate);
        }

        if (filters.toDate) {
            sql += ` AND tl.load_date <= ?`;
            params.push(filters.toDate);
        }

        sql += ` ORDER BY tl.load_date DESC`;
        return await allQuery(sql, params);
    }

    async getAllLoads(filters = {}) {
        let sql = `
            SELECT tl.*, t.registration_number, t.driver_name, u.name as loaded_by_name
            FROM truck_loads tl
            JOIN trucks t ON tl.truck_id = t.id
            JOIN users u ON tl.loaded_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.search) {
            sql += ` AND (t.registration_number LIKE ? OR t.driver_name LIKE ?)`;
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.fromDate) {
            sql += ` AND tl.load_date >= ?`;
            params.push(filters.fromDate);
        }

        if (filters.toDate) {
            sql += ` AND tl.load_date <= ?`;
            params.push(filters.toDate);
        }

        if (filters.status) {
            sql += ` AND tl.status = ?`;
            params.push(filters.status);
        }

        sql += ` ORDER BY tl.load_date DESC`;
        return await allQuery(sql, params);
    }

    async deleteLoad(id) {
        return await transaction(async () => {
            // Check status first
            const load = await getQuery('SELECT status FROM truck_loads WHERE id = ?', [id]);
            if (!load) throw new Error('Load not found');

            // Delete from unloads first (cascading deletes for unloads/unload_items)
            // If the DB has ON DELETE CASCADE it would be easier, but let's be safe.
            const unloads = await allQuery('SELECT id FROM truck_unloads WHERE load_id = ?', [id]);
            for (const unload of unloads) {
                await runQuery('DELETE FROM unload_items WHERE unload_id = ?', [unload.id]);
            }
            await runQuery('DELETE FROM truck_unloads WHERE load_id = ?', [id]);

            // Delete items
            await runQuery('DELETE FROM load_items WHERE load_id = ?', [id]);

            // Clear load_id from invoices to avoid foreign key constraint error
            await runQuery('UPDATE invoices SET load_id = NULL WHERE load_id = ?', [id]);

            // Finally delete the load
            await runQuery('DELETE FROM truck_loads WHERE id = ?', [id]);
            return true;
        });
    }

    async getVarianceReport(loadId) {
        return await allQuery(`
            SELECT 
                p.name as product_name,
                li.quantity_loaded as loaded,
                COALESCE((
                    SELECT SUM(ii.quantity) 
                    FROM invoice_items ii 
                    JOIN invoices i ON ii.invoice_id = i.id 
                    WHERE i.invoice_date = tl.load_date AND ii.product_id = li.product_id
                ), 0) as sold,
                COALESCE(ui.quantity_remaining, 0) as returned,
                COALESCE(ui.variance, 0) as variance,
                ui.variance_reason
            FROM truck_loads tl
            JOIN load_items li ON tl.id = li.load_id
            JOIN products p ON li.product_id = p.id
            LEFT JOIN truck_unloads tu ON tu.load_id = tl.id
            LEFT JOIN unload_items ui ON ui.unload_id = tu.id AND ui.product_id = li.product_id
            WHERE tl.id = ?
        `, [loadId]);
    }
}

module.exports = new DistributionRepository();
