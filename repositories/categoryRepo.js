const { runQuery, allQuery } = require('../lib/db');

class CategoryRepository {
    async getAll() {
        return await allQuery('SELECT * FROM categories ORDER BY name');
    }

    async create(name) {
        const result = await runQuery('INSERT INTO categories (name) VALUES (?)', [name]);
        return result.lastID;
    }

    async update(id, name) {
        return await runQuery('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    }

    async delete(id) {
        return await runQuery('DELETE FROM categories WHERE id = ?', [id]);
    }
}

module.exports = new CategoryRepository();
