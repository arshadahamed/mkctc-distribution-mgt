const { transaction, runQuery, allQuery, getQuery } = require('../lib/db');

class RmaRepository {
    async getAll(filters = {}) {
        let baseQuery = `
            FROM rma_requests r
            JOIN customers c ON r.customer_id = c.id
            JOIN users u ON r.handled_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            baseQuery += ' AND r.status = ?';
            params.push(filters.status);
        }

        if (filters.customer_id) {
            baseQuery += ' AND r.customer_id = ?';
            params.push(filters.customer_id);
        }

        if (filters.search) {
            baseQuery += ' AND (r.rma_number LIKE ? OR c.name LIKE ?)';
            const search = `%${filters.search}%`;
            params.push(search, search);
        }

        const query = `
            SELECT r.*, c.name as customer_name, u.name as handled_by_name
            ${baseQuery}
            ORDER BY r.request_date DESC
        `;

        return await allQuery(query, params);
    }

    async getById(id) {
        const rma = await getQuery(`
            SELECT r.*, c.name as customer_name, u.name as handled_by_name
            FROM rma_requests r
            JOIN customers c ON r.customer_id = c.id
            JOIN users u ON r.handled_by = u.id
            WHERE r.id = ?
        `, [id]);

        if (rma) {
            rma.items = await allQuery(`
                SELECT ri.*, p.name as product_name
                FROM rma_items ri
                JOIN products p ON ri.product_id = p.id
                WHERE ri.rma_id = ?
            `, [id]);
        }
        return rma;
    }

    async create(data) {
        return await transaction(async () => {
            // Calculate total value
            const totalValue = data.items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

            // Insert Request
            const rmaSql = `
                INSERT INTO rma_requests (rma_number, customer_id, invoice_id, load_id, request_date, status, total_value, remarks, handled_by)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            `;
            const rmaParams = [
                data.rma_number, data.customer_id, data.invoice_id || null, data.load_id || null,
                data.request_date, totalValue, data.remarks || null, data.handled_by
            ];
            const result = await runQuery(rmaSql, rmaParams);
            const rmaId = result.lastID;

            // Insert Items
            for (const item of data.items) {
                const itemSql = `
                    INSERT INTO rma_items (rma_id, product_id, quantity, unit_price, reason, condition)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                await runQuery(itemSql, [
                    rmaId, item.product_id, item.quantity, item.unit_price, item.reason, item.condition || 'damaged'
                ]);
            }

            return rmaId;
        });
    }

    async updateStatus(id, status, actionTaken = null, adminId) {
        return await transaction(async () => {
            const rma = await this.getById(id);
            if (!rma) throw new Error('RMA not found');

            // Update Header
            await runQuery('UPDATE rma_requests SET status = ? WHERE id = ?', [status, id]);

            // If completed, update stock or ledger based on actionTaken
            if (status === 'completed' && rma.items) {
                for (const item of rma.items) {
                    await runQuery('UPDATE rma_items SET action_taken = ? WHERE id = ?', [actionTaken || 'scrapped', item.id]);

                    if (actionTaken === 'restocked') {
                        if (rma.load_id) {
                            // If it was collected to a truck, add back to truck load items
                            const existing = await getQuery('SELECT id FROM load_items WHERE load_id = ? AND product_id = ?', [rma.load_id, item.product_id]);
                            if (existing) {
                                await runQuery('UPDATE load_items SET quantity_loaded = quantity_loaded + ? WHERE id = ?', [item.quantity, existing.id]);
                            } else {
                                await runQuery('INSERT INTO load_items (load_id, product_id, quantity_loaded) VALUES (?, ?, ?)', [rma.load_id, item.product_id, item.quantity]);
                            }
                        } else {
                            // Standard restock to warehouse
                            await runQuery('UPDATE products SET initial_stock = initial_stock + ? WHERE id = ?', [item.quantity, item.product_id]);
                        }
                    } else if (actionTaken === 'scrapped' || actionTaken === 'returned_to_supplier') {
                        // Log to damaged stock ledger
                        await runQuery(`
                            INSERT INTO damaged_stock_ledger (product_id, rma_item_id, quantity, type, remarks)
                            VALUES (?, ?, ?, ?, ?)
                        `, [item.product_id, item.id, item.quantity, 'damage', `RMA ${rma.rma_number}: ${actionTaken}`]);
                    }
                }
            }
            return true;
        });
    }

    async generateTicketNumber() {
        const last = await getQuery("SELECT id FROM rma_requests ORDER BY id DESC LIMIT 1");
        const nextId = (last?.id || 0) + 1;
        return `RMA-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${nextId.toString().padStart(4, '0')}`;
    }

    async delete(id) {
        return await transaction(async () => {
            await runQuery('DELETE FROM rma_items WHERE rma_id = ?', [id]);
            await runQuery('DELETE FROM rma_requests WHERE id = ?', [id]);
            return true;
        });
    }

    async getDamagedStock() {
        const sql = `
            SELECT d.*, p.name as product_name, ri.reason, r.rma_number
            FROM damaged_stock_ledger d
            JOIN products p ON d.product_id = p.id
            LEFT JOIN rma_items ri ON d.rma_item_id = ri.id
            LEFT JOIN rma_requests r ON ri.rma_id = r.id
            ORDER BY d.created_at DESC
        `;
        return await allQuery(sql);
    }
}

module.exports = new RmaRepository();
