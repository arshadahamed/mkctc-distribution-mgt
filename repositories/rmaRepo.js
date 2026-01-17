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
                    INSERT INTO rma_items (rma_id, product_id, quantity, unit_price, reason, condition, batch_number, price_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await runQuery(itemSql, [
                    rmaId, item.product_id, item.quantity, item.unit_price, item.reason, item.condition || 'damaged',
                    item.batch_number || null, item.price_id || null
                ]);
            }

            return rmaId;
        });
    }

    async updateStatus(id, status, actionTaken = null, adminId) {
        return await transaction(async () => {
            const rma = await this.getById(id);
            if (!rma) throw new Error('RMA not found');

            // Prevent double-processing if already completed
            if (rma.status === 'completed' && status === 'completed') return true;

            // Update Header
            await runQuery('UPDATE rma_requests SET status = ? WHERE id = ?', [status, id]);

            // If completed, update stock and customer financial state
            if (status === 'completed' && rma.items) {
                for (const item of rma.items) {
                    await runQuery('UPDATE rma_items SET action_taken = ? WHERE id = ?', [actionTaken || 'scrapped', item.id]);

                    if (actionTaken === 'restocked') {
                        if (rma.load_id) {
                            // --- SELLABLE RETURN TO ACTIVE TRUCK ---
                            // 1. Resolve price_id if missing (essential for POS visibility)
                            let priceId = item.price_id;
                            if (!priceId) {
                                let priceRow;
                                if (item.batch_number) {
                                    priceRow = await getQuery('SELECT id FROM product_prices WHERE product_id = ? AND batch_number = ?', [item.product_id, item.batch_number]);
                                }
                                if (!priceRow) {
                                    priceRow = await getQuery('SELECT id FROM product_prices WHERE product_id = ? AND is_primary = 1', [item.product_id]);
                                }
                                priceId = priceRow?.id;
                            }

                            // 2. Add to load_items (Active Truck Stock)
                            const existing = await getQuery('SELECT id FROM load_items WHERE load_id = ? AND product_id = ? AND (price_id = ? OR (price_id IS NULL AND ? IS NULL))',
                                [rma.load_id, item.product_id, priceId, priceId]);

                            if (existing) {
                                await runQuery('UPDATE load_items SET quantity_loaded = quantity_loaded + ? WHERE id = ?', [item.quantity, existing.id]);
                            } else {
                                await runQuery('INSERT INTO load_items (load_id, product_id, price_id, batch_number, quantity_loaded) VALUES (?, ?, ?, ?, ?)',
                                    [rma.load_id, item.product_id, priceId, item.batch_number, item.quantity]);
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

                // --- FINANCIAL ADJUSTMENT ---
                // 1. Update Customer Balance (Subtraction because RMA reduces debt)
                const customerRepo = require('./customerRepo');
                await customerRepo.updateBalance(rma.customer_id, -rma.total_value);

                // 2. Create Receipt Entry (Category 'collection' decreases balance in payment logic)
                const creditNoteRef = `CRN-${rma.rma_number.split('-').pop()}`;
                await runQuery(`
                    INSERT INTO receipts (receipt_number, receipt_date, customer_id, amount, payment_type, receiver_name, collected_by, receipt_category)
                    VALUES (?, ?, ?, ?, 'account', 'RMA Settlement', ?, 'collection')
                `, [creditNoteRef, new Date().toISOString().split('T')[0], rma.customer_id, rma.total_value, adminId]);
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
