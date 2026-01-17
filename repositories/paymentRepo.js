const { transaction, runQuery, allQuery, getQuery } = require('../lib/db');
const customerRepo = require('./customerRepo');

class PaymentRepository {
    async createReceipt(receiptData) {
        return await transaction(async () => {
            const receiptNumber = await this.generateReceiptNumber();

            // Insert receipt
            const receiptSql = `
                INSERT INTO receipts (receipt_number, receipt_date, customer_id, amount, payment_type, receiver_name, collected_by, receipt_category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const category = receiptData.receipt_category || 'collection';
            const receiptParams = [
                receiptNumber, receiptData.receipt_date, receiptData.customer_id,
                receiptData.amount, receiptData.payment_type, receiptData.receiver_name, receiptData.collected_by,
                category
            ];

            const receiptResult = await runQuery(receiptSql, receiptParams);
            const receiptId = receiptResult.lastID;

            // Handle multiple cheques if provided
            if (receiptData.cheques && Array.isArray(receiptData.cheques)) {
                const chequeSql = `
                    INSERT INTO cheque_details (receipt_id, cheque_number, cheque_date, bank_name, amount, cheque_image)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                for (const chq of receiptData.cheques) {
                    await runQuery(chequeSql, [
                        receiptId, chq.number || chq.cheque_number, chq.date || chq.cheque_date,
                        chq.bank_name || chq.bank, chq.amount, chq.image || chq.cheque_image || null
                    ]);
                }
            } else if (receiptData.payment_type === 'cheque' && receiptData.cheque) {
                // FALLBACK for single cheque
                const chequeSql = `
                    INSERT INTO cheque_details (receipt_id, cheque_number, cheque_date, bank_name, amount, cheque_image)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                const chequeParams = [
                    receiptId, receiptData.cheque.number || receiptData.cheque.cheque_number,
                    receiptData.cheque.date || receiptData.cheque.cheque_date,
                    receiptData.cheque.bank_name || receiptData.cheque.bank, receiptData.amount,
                    receiptData.cheque.image || receiptData.cheque.cheque_image || null
                ];
                await runQuery(chequeSql, chequeParams);
            }

            // Allocate to invoices if provided
            if (receiptData.allocations && receiptData.allocations.length > 0) {
                for (const allocation of receiptData.allocations) {
                    const allocSql = `
                        INSERT INTO receipt_allocations (receipt_id, invoice_id, allocated_amount)
                        VALUES (?, ?, ?)
                    `;
                    await runQuery(allocSql, [receiptId, allocation.invoice_id, allocation.amount]);
                }
            }

            // Update customer balance
            // collection: subtract from balance
            // return: add to balance
            const balanceAdjustment = category === 'return' ? receiptData.amount : -receiptData.amount;
            await customerRepo.updateBalance(receiptData.customer_id, balanceAdjustment);

            return receiptId;
        });
    }

    async generateReceiptNumber() {
        const date = new Date();
        const yearMonth = date.getFullYear().toString().slice(-2) +
            (date.getMonth() + 1).toString().padStart(2, '0');

        const lastReceipt = await getQuery('SELECT receipt_number FROM receipts ORDER BY id DESC LIMIT 1');

        let sequence = '0001';
        if (lastReceipt && lastReceipt.receipt_number.startsWith('RCP' + yearMonth)) {
            const lastSeq = parseInt(lastReceipt.receipt_number.slice(-4));
            sequence = (lastSeq + 1).toString().padStart(4, '0');
        }

        return `RCP${yearMonth}${sequence}`;
    }

    async getAll(filters = {}) {
        let query = `
            SELECT r.*, c.name as customer_name
            FROM receipts r
            JOIN customers c ON r.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.customer_id) {
            query += ' AND r.customer_id = ?';
            params.push(filters.customer_id);
        }

        if (filters.date_from) {
            query += ' AND r.receipt_date >= ?';
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            query += ' AND r.receipt_date <= ?';
            params.push(filters.date_to);
        }

        if (filters.search) {
            query += ' AND (r.receipt_number LIKE ? OR c.name LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.payment_method) {
            query += ' AND r.payment_type = ?';
            params.push(filters.payment_method);
        }

        if (filters.receipt_category) {
            query += ' AND r.receipt_category = ?';
            params.push(filters.receipt_category);
        }

        query += ' ORDER BY r.id DESC';
        return await allQuery(query, params);
    }

    async getById(id) {
        const receipt = await getQuery(`
            SELECT r.*, c.name as customer_name
            FROM receipts r
            JOIN customers c ON r.customer_id = c.id
            WHERE r.id = ?
        `, [id]);

        if (receipt) {
            receipt.allocations = await allQuery(`
                SELECT ra.*, i.invoice_number, i.invoice_date
                FROM receipt_allocations ra
                JOIN invoices i ON ra.invoice_id = i.id
                WHERE ra.receipt_id = ?
            `, [id]);

            if (receipt.payment_type === 'cheque') {
                receipt.cheques = await allQuery('SELECT * FROM cheque_details WHERE receipt_id = ?', [id]);
                if (receipt.cheques && receipt.cheques.length > 0) {
                    receipt.cheque = receipt.cheques[0];
                }
            }
        }

        return receipt;
    }

    async getOutstandingInvoices(customerId) {
        const query = `
            SELECT 
                i.id,
                i.invoice_number,
                i.invoice_date,
                i.net_total,
                i.net_total - COALESCE((SELECT SUM(allocated_amount) FROM receipt_allocations WHERE invoice_id = i.id), 0) as pending_amount
            FROM invoices i
            WHERE i.customer_id = ? AND i.payment_method = 'account'
            HAVING pending_amount > 0
            ORDER BY i.invoice_date ASC
        `;
        // Note: SQLite doesn't support HAVING pending_amount > 0 with an alias sometimes, 
        // so we wrap it or use the full expression.
        const pendingQuery = `
            SELECT * FROM (
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.invoice_date,
                    i.net_total,
                    i.net_total - COALESCE((SELECT SUM(allocated_amount) FROM receipt_allocations WHERE invoice_id = i.id), 0) as pending_amount
                FROM invoices i
                WHERE i.customer_id = ? AND i.payment_method = 'account'
            ) WHERE pending_amount > 0
            ORDER BY invoice_date ASC
        `;
        return await allQuery(pendingQuery, [customerId]);
    }

    async getPaymentSummary(filters = {}) {
        let query = `
            SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN receipt_category = 'return' THEN 1 ELSE 0 END) as return_count,
                SUM(CASE WHEN receipt_category = 'collection' THEN 1 ELSE 0 END) as collection_count,
                SUM(CASE WHEN receipt_category = 'return' THEN -amount ELSE amount END) as total_net_collected,
                SUM(CASE WHEN payment_type = 'cash' THEN (CASE WHEN receipt_category = 'return' THEN -amount ELSE amount END) ELSE 0 END) as cash_net_collected,
                SUM(CASE WHEN payment_type = 'cheque' THEN (CASE WHEN receipt_category = 'return' THEN -amount ELSE amount END) ELSE 0 END) as cheque_net_collected
            FROM receipts
            WHERE 1=1
        `;
        const params = [];

        if (filters.date_from) {
            query += ' AND receipt_date >= ?';
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            query += ' AND receipt_date <= ?';
            params.push(filters.date_to);
        }

        return await getQuery(query, params);
    }
    async deleteReceipt(id) {
        return await transaction(async () => {
            const receipt = await getQuery('SELECT * FROM receipts WHERE id = ?', [id]);
            if (!receipt) throw new Error('Receipt not found');

            // 1. Delete allocations
            await runQuery('DELETE FROM receipt_allocations WHERE receipt_id = ?', [id]);

            // 2. Delete cheque details
            await runQuery('DELETE FROM cheque_details WHERE receipt_id = ?', [id]);

            // 3. Reverse customer balance
            await customerRepo.updateBalance(receipt.customer_id, receipt.amount);

            // 4. Delete the receipt
            await runQuery('DELETE FROM receipts WHERE id = ?', [id]);

            return true;
        });
    }

    async updateReceipt(id, data) {
        return await transaction(async () => {
            const oldReceipt = await getQuery('SELECT * FROM receipts WHERE id = ?', [id]);
            if (!oldReceipt) throw new Error('Receipt not found');

            const newAmount = parseFloat(data.amount);
            const amountDiff = newAmount - oldReceipt.amount;

            // 1. Update receipts table
            await runQuery(`
                UPDATE receipts 
                SET receipt_date = ?, receiver_name = ?, amount = ?, payment_type = ?
                WHERE id = ?
            `, [data.receipt_date, data.receiver_name, newAmount, data.payment_type, id]);

            // 2. Adjust customer balance if amount changed
            if (amountDiff !== 0) {
                await customerRepo.updateBalance(oldReceipt.customer_id, -amountDiff);
            }

            // 3. Handle cheque details
            if (data.payment_type === 'cheque') {
                const existingCheque = await getQuery('SELECT id FROM cheque_details WHERE receipt_id = ?', [id]);
                if (existingCheque) {
                    await runQuery(`
                        UPDATE cheque_details
                        SET cheque_number = ?, cheque_date = ?, bank_name = ?, amount = ?, cheque_image = COALESCE(?, cheque_image)
                        WHERE receipt_id = ?
                    `, [data.cheque.number || data.cheque.cheque_number, data.cheque.date || data.cheque.cheque_date, data.cheque.bank_name || data.cheque.bank, newAmount, data.cheque.image || null, id]);
                } else {
                    await runQuery(`
                        INSERT INTO cheque_details (receipt_id, cheque_number, cheque_date, bank_name, amount, cheque_image)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [id, data.cheque.number || data.cheque.cheque_number, data.cheque.date || data.cheque.cheque_date, data.cheque.bank_name || data.cheque.bank, newAmount, data.cheque.image || null]);
                }
            } else if (oldReceipt.payment_type === 'cheque') {
                // If changed FROM cheque TO cash, delete cheque details
                await runQuery('DELETE FROM cheque_details WHERE receipt_id = ?', [id]);
            }

            return true;
        });
    }
}

module.exports = new PaymentRepository();
