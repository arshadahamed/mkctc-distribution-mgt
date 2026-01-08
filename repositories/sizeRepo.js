const { runQuery, allQuery } = require('../lib/db');

class SizeRepository {
    async getAll() {
        return await allQuery('SELECT * FROM sizes ORDER BY name');
    }

    async create(name) {
        const result = await runQuery('INSERT INTO sizes (name) VALUES (?)', [name]);
        return result.lastID;
    }

    async update(id, name) {
        return await runQuery('UPDATE sizes SET name = ? WHERE id = ?', [name, id]);
    }

    async delete(id) {
        return await runQuery('DELETE FROM sizes WHERE id = ?', [id]);
    }
}

module.exports = new SizeRepository();
