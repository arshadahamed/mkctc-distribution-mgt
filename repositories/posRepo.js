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
                p.supplier_discount,
                p.allow_free_issue,
                p.weighted,
                p.unit,
                SUM(li.quantity_loaded) as loaded_quantity,
                (
                    SELECT COALESCE(SUM(ii.quantity), 0)
                    FROM invoice_items ii
                    JOIN invoices i ON ii.invoice_id = i.id
                    WHERE ii.product_id = p.id 
                    AND i.load_id = ? 
                    AND i.status = 'completed'
                ) as sold_quantity
            FROM load_items li
            JOIN products p ON li.product_id = p.id
            WHERE li.load_id = ?
            GROUP BY p.id
        `;

        const rows = await allQuery(sql, [loadId, loadId]);

        const productsWithStock = [];
        for (const row of rows) {
            // Get prices that were specifically loaded for this load, with their specific stock levels
            let prices = await allQuery(`
                SELECT pp.*,
                       (SELECT COALESCE(SUM(li2.quantity_loaded), 0) 
                        FROM load_items li2 
                        WHERE li2.load_id = ? AND li2.product_id = pp.product_id AND li2.price_id = pp.id) as batch_loaded,
                       (SELECT COALESCE(SUM(ii.quantity), 0)
                        FROM invoice_items ii
                        JOIN invoices i ON ii.invoice_id = i.id
                        WHERE i.load_id = ? AND ii.product_id = pp.product_id 
                        AND (ii.batch_number = pp.batch_number OR (ii.batch_number IS NULL AND pp.batch_number IS NULL))
                        AND i.status = 'completed') as batch_sold
                FROM product_prices pp
                JOIN load_items li ON pp.id = li.price_id
                WHERE li.load_id = ? AND li.product_id = ?
                GROUP BY pp.id
            `, [loadId, loadId, loadId, row.id]);

            // Fallback: If no specific prices were found in load_items, fetch all product prices
            if (prices.length === 0) {
                prices = await allQuery('SELECT * FROM product_prices WHERE product_id = ?', [row.id]);
                // For fallback, we just assign the total loaded/sold to the primary or divide?
                // Usually it means there's only one price or it's old data.
            }

            productsWithStock.push({
                ...row,
                available_quantity: row.loaded_quantity - row.sold_quantity,
                prices: prices.map(p => ({
                    ...p,
                    available_qty: (p.batch_loaded !== undefined) ? (p.batch_loaded - p.batch_sold) : (row.loaded_quantity - row.sold_quantity)
                }))
            });
        }
        return productsWithStock;
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
