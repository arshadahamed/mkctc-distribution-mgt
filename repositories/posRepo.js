const { allQuery, getQuery } = require('../lib/db');

const posRepo = {
    /**
     * Get products in a specific truck load with current stock availability
     */
    async getTruckStock(loadId) {
        // Query to get loaded quantities and subtract sold quantities
        const sql = `
            SELECT 
                p.id, 
                p.name, 
                p.reference_code,
                p.msrp,
                li.quantity_loaded as loaded_quantity,
                COALESCE((
                    SELECT SUM(ii.quantity)
                    FROM invoice_items ii
                    JOIN invoices i ON ii.invoice_id = i.id
                    WHERE ii.product_id = p.id 
                    AND i.load_id = ? 
                    AND i.status = 'completed'
                ), 0) as sold_quantity
            FROM load_items li
            JOIN products p ON li.product_id = p.id
            WHERE li.load_id = ?
        `;

        const rows = await allQuery(sql, [loadId, loadId]);
        return rows.map(row => ({
            ...row,
            available_quantity: row.loaded_quantity - row.sold_quantity
        }));
    },

    /**
     * Get active loads (status = 'loaded') for POS selection
     */
    async getActiveLoads() {
        const sql = `
            SELECT tl.*, t.registration_number as vehicle_number, u.name as driver_name
            FROM truck_loads tl
            JOIN trucks t ON tl.truck_id = t.id
            JOIN users u ON tl.loaded_by = u.id
            WHERE tl.status = 'loaded'
            ORDER BY tl.load_date DESC
        `;
        return await allQuery(sql);
    }
};

module.exports = posRepo;
