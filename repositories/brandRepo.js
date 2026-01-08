const { runQuery, allQuery } = require('../lib/db');

class BrandRepository {
    async getAll() {
        return await allQuery('SELECT * FROM brands ORDER BY name');
    }

    async create(name) {
        const result = await runQuery('INSERT INTO brands (name) VALUES (?)', [name]);
        return result.lastID;
    }

    async update(id, name) {
        return await runQuery('UPDATE brands SET name = ? WHERE id = ?', [name, id]);
    }

    async delete(id) {
        return await runQuery('DELETE FROM brands WHERE id = ?', [id]);
    }
}

module.exports = new BrandRepository();
