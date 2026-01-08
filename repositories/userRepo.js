const { allQuery, getQuery, runQuery } = require('../lib/db');
const bcrypt = require('bcryptjs');

class UserRepository {
    async getAll() {
        return await allQuery('SELECT id, name, username, password, role, login_status, last_login, created_at, permissions, is_blocked FROM users ORDER BY name');
    }

    async getById(id) {
        return await getQuery('SELECT * FROM users WHERE id = ?', [id]);
    }

    async getByUsername(username) {
        return await getQuery('SELECT * FROM users WHERE username = ?', [username]);
    }

    async create(user) {
        // Hash password before saving
        const hashedPassword = await bcrypt.hash(user.password, 10);

        const sql = `
            INSERT INTO users (name, username, password, role, permissions, is_blocked)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [
            user.name,
            user.username,
            hashedPassword,
            user.role || 'employee',
            user.permissions || '[]',
            user.is_blocked || 0
        ];
        return await runQuery(sql, params);
    }

    async update(id, user) {
        let fields = [];
        let params = [];

        if (user.name) { fields.push('name = ?'); params.push(user.name); }
        if (user.username) { fields.push('username = ?'); params.push(user.username); }

        if (user.password) {
            // Hash password before updating
            const hashedPassword = await bcrypt.hash(user.password, 10);
            fields.push('password = ?');
            params.push(hashedPassword);
        }

        if (user.role) { fields.push('role = ?'); params.push(user.role); }
        if (user.permissions) { fields.push('permissions = ?'); params.push(user.permissions); }
        if (user.is_blocked !== undefined) { fields.push('is_blocked = ?'); params.push(user.is_blocked); }
        if (user.login_status) { fields.push('login_status = ?'); params.push(user.login_status); }

        if (fields.length === 0) return { changes: 0 };

        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        params.push(id);

        return await runQuery(sql, params);
    }

    async updateLoginStatus(id, status) {
        return await runQuery('UPDATE users SET login_status = ? WHERE id = ?', [status, id]);
    }

    async delete(id) {
        return await runQuery('DELETE FROM users WHERE id = ?', [id]);
    }

    async invalidateTokens(id) {
        // Increment token_version, handling nulls with coalesce
        return await runQuery('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?', [id]);
    }
}

module.exports = new UserRepository();
