const { getDatabase, allQuery, getQuery, runQuery } = require('../lib/db');

class CustomerRepository {
    async getAll(filters = {}) {
        const showDeleted = filters.status === 'deleted';
        let baseQuery = `
            FROM customers c
            LEFT JOIN routes r ON c.route_id = r.id
            LEFT JOIN price_levels pl ON c.price_level_id = pl.id
            WHERE c.is_deleted = ${showDeleted ? 1 : 0}
        `;

        const params = [];
        const countParams = [];

        if (filters.status && filters.status !== 'deleted') {
            baseQuery += ' AND c.status = ?';
            params.push(filters.status);
            countParams.push(filters.status);
        }

        if (filters.route_id) {
            baseQuery += ' AND c.route_id = ?';
            params.push(filters.route_id);
            countParams.push(filters.route_id);
        }

        if (filters.search) {
            baseQuery += ' AND (c.name LIKE ? OR c.contact LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm);
        }

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
        const countResult = await getQuery(countQuery, countParams);
        const totalCount = countResult?.total || 0;

        // Pagination
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 20;
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(totalCount / limit);

        const query = `
            SELECT c.*, r.name as route_name, pl.name as price_level_name
            ${baseQuery}
            ORDER BY c.name
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const data = await allQuery(query, params);

        return {
            data,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages
            }
        };
    }

    async getById(id) {
        return await getQuery('SELECT * FROM customers WHERE id = ? AND is_deleted = 0', [id]);
    }

    async create(customer) {
        const sql = `
            INSERT INTO customers (name, address, contact, category, route_id, price_level_id, credit_limit, account_balance, status, latitude, longitude, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;
        const params = [
            customer.name, customer.address, customer.contact, customer.category,
            customer.route_id, customer.price_level_id || null, customer.credit_limit || 0, customer.account_balance || 0, customer.status || 'active',
            customer.latitude || null, customer.longitude || null
        ];
        const result = await runQuery(sql, params);
        return result.lastID;
    }

    async update(id, customer) {
        const sql = `
            UPDATE customers SET
                name = ?, address = ?, contact = ?, category = ?,
                route_id = ?, price_level_id = ?, credit_limit = ?, account_balance = ?, status = ?,
                latitude = ?, longitude = ?
            WHERE id = ? AND is_deleted = 0
        `;
        const params = [
            customer.name, customer.address, customer.contact, customer.category,
            customer.route_id, customer.price_level_id || null, customer.credit_limit || 0, customer.account_balance || 0, customer.status,
            customer.latitude || null, customer.longitude || null, id
        ];
        return await runQuery(sql, params);
    }

    async delete(id) {
        return await runQuery('UPDATE customers SET is_deleted = 1 WHERE id = ?', [id]);
    }

    async deletePermanent(id) {
        return await runQuery('DELETE FROM customers WHERE id = ?', [id]);
    }

    async restore(id) {
        return await runQuery('UPDATE customers SET is_deleted = 0 WHERE id = ?', [id]);
    }

    async updateBalance(customerId, amount) {
        const sql = 'UPDATE customers SET account_balance = account_balance + ? WHERE id = ?';
        return await runQuery(sql, [amount, customerId]);
    }

    async getLedger(customerId) {
        const sql = `
            SELECT 
                invoice_date as date, 
                invoice_number as reference, 
                'Invoice' as type, 
                net_total as debit, 
                0 as credit
            FROM invoices 
            WHERE customer_id = ? AND payment_method = 'account'

            UNION ALL

            SELECT 
                receipt_date as date, 
                receipt_number as reference, 
                'Receipt' as type, 
                0 as debit, 
                amount as credit
            FROM receipts 
            WHERE customer_id = ?

            UNION ALL

            SELECT 
                cd.cheque_date as date, 
                cd.cheque_number as reference, 
                'Returned Cheque' as type, 
                cd.amount as debit, 
                0 as credit
            FROM cheque_details cd
            LEFT JOIN receipts r ON cd.receipt_id = r.id
            LEFT JOIN invoices i ON cd.invoice_id = i.id
            WHERE COALESCE(r.customer_id, i.customer_id) = ? AND cd.status = 'Returned'

            ORDER BY date ASC
        `;
        return await allQuery(sql, [customerId, customerId, customerId]);
    }
}

module.exports = new CustomerRepository();
