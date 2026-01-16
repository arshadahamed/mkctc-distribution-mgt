const { allQuery, getQuery, runQuery } = require('../lib/db');

const priceLevelRepo = {
    async getAll() {
        return await allQuery('SELECT * FROM price_levels ORDER BY name');
    },

    async getById(id) {
        return await getQuery('SELECT * FROM price_levels WHERE id = ?', [id]);
    },

    async create(data) {
        if (data.is_default) {
            await runQuery('UPDATE price_levels SET is_default = 0');
        }
        const sql = 'INSERT INTO price_levels (name, description, is_default) VALUES (?, ?, ?)';
        const res = await runQuery(sql, [data.name, data.description || null, data.is_default ? 1 : 0]);
        return res.lastID;
    },

    async update(id, data) {
        if (data.is_default) {
            await runQuery('UPDATE price_levels SET is_default = 0');
        }
        const sql = 'UPDATE price_levels SET name = ?, description = ?, is_default = ? WHERE id = ?';
        return await runQuery(sql, [data.name, data.description || null, data.is_default ? 1 : 0, id]);
    },

    async delete(id) {
        // Prevent deleting MSRP or protected levels if needed
        return await runQuery('DELETE FROM price_levels WHERE id = ?', [id]);
    }
};

module.exports = priceLevelRepo;
