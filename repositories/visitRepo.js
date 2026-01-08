const { allQuery, getQuery, runQuery } = require('../lib/db');

class VisitRepository {
    async getAll(filters = {}) {
        let query = `
            SELECT v.*, c.name as customer_name, r.name as route_name, u.name as user_name
            FROM shop_visits v
            JOIN customers c ON v.customer_id = c.id
            JOIN routes r ON v.route_id = r.id
            LEFT JOIN users u ON v.visited_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.customer_id) {
            query += ' AND v.customer_id = ?';
            params.push(filters.customer_id);
        }

        if (filters.route_id) {
            query += ' AND v.route_id = ?';
            params.push(filters.route_id);
        }

        if (filters.shop_status) {
            query += ' AND v.shop_status = ?';
            params.push(filters.shop_status);
        }

        if (filters.date_from) {
            query += ' AND v.visit_date >= ?';
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            query += ' AND v.visit_date <= ?';
            params.push(filters.date_to);
        }

        if (filters.search) {
            query += ' AND c.name LIKE ?';
            params.push(`%${filters.search}%`);
        }

        query += ' ORDER BY v.visit_date DESC, v.id DESC';
        return await allQuery(query, params);
    }

    async getById(id) {
        return await getQuery('SELECT * FROM shop_visits WHERE id = ?', [id]);
    }

    async create(data) {
        const sql = `
            INSERT INTO shop_visits (visit_date, customer_id, route_id, shop_status, remarks, visited_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.visit_date, data.customer_id, data.route_id,
            data.shop_status, data.remarks, data.visited_by
        ];
        const result = await runQuery(sql, params);
        return result.lastID;
    }

    async update(id, data) {
        const sql = `
            UPDATE shop_visits SET
                visit_date = ?, customer_id = ?, route_id = ?, 
                shop_status = ?, remarks = ?
            WHERE id = ?
        `;
        const params = [
            data.visit_date, data.customer_id, data.route_id,
            data.shop_status, data.remarks, id
        ];
        return await runQuery(sql, params);
    }

    async delete(id) {
        return await runQuery('DELETE FROM shop_visits WHERE id = ?', [id]);
    }
}

module.exports = new VisitRepository();
