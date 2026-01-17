const { allQuery, getQuery, runQuery } = require('../lib/db');

class RouteRepository {
    async getAll(search = '') {
        let sql = `
            SELECT r.*, 
            (SELECT COUNT(*) FROM customers WHERE route_id = r.id AND status != 'deleted') as customer_count
            FROM routes r 
        `;
        const params = [];
        if (search) {
            sql += ` WHERE r.name LIKE ? OR r.description LIKE ? `;
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ` ORDER BY r.name `;
        return await allQuery(sql, params);
    }

    async getById(id) {
        return await getQuery('SELECT * FROM routes WHERE id = ?', [id]);
    }

    async create(data) {
        const sql = 'INSERT INTO routes (name, description) VALUES (?, ?)';
        const result = await runQuery(sql, [data.name, data.description]);
        return result.lastID;
    }

    async update(id, data) {
        const sql = 'UPDATE routes SET name = ?, description = ? WHERE id = ?';
        return await runQuery(sql, [data.name, data.description, id]);
    }

    async delete(id) {
        return await runQuery('DELETE FROM routes WHERE id = ?', [id]);
    }
}

module.exports = new RouteRepository();
