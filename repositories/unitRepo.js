const { runQuery, allQuery } = require('../lib/db');

class UnitRepository {
    async getAll() {
        return await allQuery('SELECT * FROM units ORDER BY name');
    }

    async create(name) {
        const result = await runQuery('INSERT INTO units (name) VALUES (?)', [name]);
        return result.lastID;
    }

    async update(id, name) {
        return await runQuery('UPDATE units SET name = ? WHERE id = ?', [name, id]);
    }

    async delete(id) {
        return await runQuery('DELETE FROM units WHERE id = ?', [id]);
    }
}

module.exports = new UnitRepository();
