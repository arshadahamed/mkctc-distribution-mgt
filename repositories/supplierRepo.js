const { runQuery, allQuery, getQuery } = require('../lib/db');

class SupplierRepository {
    async getAll(filters = {}) {
        let baseQuery = 'FROM suppliers WHERE 1=1';
        const params = [];
        const countParams = [];

        if (filters.search) {
            baseQuery += ' AND (name LIKE ? OR contact LIKE ? OR category LIKE ? OR tags LIKE ? OR tsr_name LIKE ? OR area_manager_name LIKE ?)';
            const search = `%${filters.search}%`;
            params.push(search, search, search, search, search, search);
            countParams.push(search, search, search, search, search, search);
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

        const query = `SELECT * ${baseQuery} ORDER BY name LIMIT ? OFFSET ?`;
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
        return await getQuery('SELECT * FROM suppliers WHERE id = ?', [id]);
    }

    async create(data) {
        const sql = `
            INSERT INTO suppliers (name, address, contact, category, tags, tsr_name, area_manager_name) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.name, data.address, data.contact,
            data.category || null, data.tags || null,
            data.tsr_name || null, data.area_manager_name || null
        ];
        const result = await runQuery(sql, params);
        return result.lastID;
    }

    async update(id, data) {
        const sql = `
            UPDATE suppliers 
            SET name = ?, address = ?, contact = ?, category = ?, tags = ?, tsr_name = ?, area_manager_name = ? 
            WHERE id = ?
        `;
        const params = [
            data.name, data.address, data.contact,
            data.category || null, data.tags || null,
            data.tsr_name || null, data.area_manager_name || null,
            id
        ];
        return await runQuery(sql, params);
    }

    async delete(id) {
        const { transaction, runQuery } = require('../lib/db');
        return await transaction(async () => {
            // Unlink from products (Set supplier_id to null)
            await runQuery('UPDATE products SET supplier_id = NULL WHERE supplier_id = ?', [id]);
            // Delete the supplier
            return await runQuery('DELETE FROM suppliers WHERE id = ?', [id]);
        });
    }
}

module.exports = new SupplierRepository();
