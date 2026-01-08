const { transaction, runQuery, allQuery, getQuery } = require('../lib/db');

class ExpenseRepository {
    async create(data) {
        const sql = `
            INSERT INTO expenses (date, category, amount, description, reference_no, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.date,
            data.category,
            data.amount,
            data.description,
            data.reference_no,
            data.created_by
        ];

        const result = await runQuery(sql, params);
        return result.lastID;
    }

    async getAll(filters = {}) {
        let query = `SELECT * FROM expenses WHERE 1=1`;
        const params = [];

        if (filters.date_from) {
            query += ' AND date >= ?';
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            query += ' AND date <= ?';
            params.push(filters.date_to);
        }

        if (filters.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }

        query += ' ORDER BY date DESC, id DESC';
        return await allQuery(query, params);
    }

    async getById(id) {
        return await getQuery('SELECT * FROM expenses WHERE id = ?', [id]);
    }

    async update(id, data) {
        const sql = `
            UPDATE expenses 
            SET date = ?, category = ?, amount = ?, description = ?, reference_no = ?
            WHERE id = ?
        `;
        const params = [
            data.date,
            data.category,
            data.amount,
            data.description,
            data.reference_no,
            id
        ];

        await runQuery(sql, params);
        return true;
    }

    async delete(id) {
        await runQuery('DELETE FROM expenses WHERE id = ?', [id]);
        return true;
    }

    async getTodayTotal(today) {
        if (!today) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            today = `${yyyy}-${mm}-${dd}`;
        }
        const res = await getQuery('SELECT SUM(amount) as total FROM expenses WHERE date(date) = date(?)', [today]);
        return res?.total || 0;
    }
}

module.exports = new ExpenseRepository();
