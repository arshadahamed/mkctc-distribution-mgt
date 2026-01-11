const { getDatabase, allQuery, getQuery, runQuery, transaction } = require('../lib/db');

class ProductRepository {
    async getAll(filters = {}) {
        let baseQuery = `
            FROM products p
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE 1=1
        `;

        const params = [];
        const countParams = [];

        if (filters.status) {
            baseQuery += ' AND p.status = ?';
            params.push(filters.status);
            countParams.push(filters.status);
        }

        if (filters.search) {
            baseQuery += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.reference_code LIKE ? OR p.tags LIKE ? OR p.chemical_name LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
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

        let query = `
            SELECT p.*, 
                   d.name as department_name,
                   c.name as category_name,
                   b.name as brand_name,
                   s.name as supplier_name,
                   (SELECT COUNT(*) FROM product_prices WHERE product_id = p.id) as price_count
            ${baseQuery}
            ORDER BY p.name
            LIMIT ? OFFSET ?
        `;
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
        const product = await getQuery(`
            SELECT p.*, 
                   d.name as department_name,
                   c.name as category_name,
                   b.name as brand_name,
                   s.name as supplier_name
            FROM products p
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = ?
        `, [id]);

        if (product) {
            product.prices = await allQuery('SELECT * FROM product_prices WHERE product_id = ?', [id]);
        }
        return product;
    }

    async getByBarcode(barcode) {
        return await getQuery('SELECT * FROM products WHERE barcode = ?', [barcode]);
    }

    async create(product) {
        return await transaction(async () => {
            const sql = `
                INSERT INTO products 
                (name, description, chemical_name, initial_stock, department_id, category_id, brand_id, supplier_id, 
                 unit, size, units_per_carton, cost, msrp, supplier_discount, weighted, reference_code, barcode, product_image, tags, status, allow_free_issue)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                product.name || null,
                product.description || null,
                product.chemical_name || null,
                product.initial_stock || 0,
                product.department_id || null,
                product.category_id || null,
                product.brand_id || null,
                product.supplier_id || null,
                product.unit || 'pcs',
                product.size || null,
                product.units_per_carton || 1,
                product.cost || 0,
                product.msrp || 0,
                product.supplier_discount || 0,
                product.weighted ? 1 : 0,
                product.reference_code || null,
                product.barcode || null,
                product.product_image || null,
                product.tags || null,
                product.status || 'active',
                product.allow_free_issue !== undefined ? (product.allow_free_issue ? 1 : 0) : 1
            ];

            const result = await runQuery(sql, params);
            const productId = result.lastID;

            // Handle multiple prices
            if (product.prices && Array.isArray(product.prices)) {
                for (const p of product.prices) {
                    await runQuery(`
                        INSERT INTO product_prices (product_id, label, price, is_primary)
                        VALUES (?, ?, ?, ?)
                    `, [productId, p.label, p.price, p.is_primary ? 1 : 0]);
                }
            }

            return productId;
        });
    }

    async update(id, product) {
        return await transaction(async () => {
            const sql = `
                UPDATE products SET
                    name = ?, description = ?, chemical_name = ?, initial_stock = ?, department_id = ?, category_id = ?,
                    brand_id = ?, supplier_id = ?, unit = ?, size = ?, units_per_carton = ?, cost = ?, msrp = ?,
                    supplier_discount = ?, weighted = ?, reference_code = ?, barcode = ?, product_image = ?, tags = ?, status = ?,
                    allow_free_issue = ?
                WHERE id = ?
            `;

            const params = [
                product.name || null,
                product.description || null,
                product.chemical_name || null,
                product.initial_stock || 0,
                product.department_id || null,
                product.category_id || null,
                product.brand_id || null,
                product.supplier_id || null,
                product.unit || 'pcs',
                product.size || null,
                product.units_per_carton || 1,
                product.cost || 0,
                product.msrp || 0,
                product.supplier_discount || 0,
                product.weighted ? 1 : 0,
                product.reference_code || null,
                product.barcode || null,
                product.product_image || null,
                product.tags || null,
                product.status || 'active',
                product.allow_free_issue !== undefined ? (product.allow_free_issue ? 1 : 0) : 1,
                id
            ];

            await runQuery(sql, params);

            // Update prices: simpler to delete existing and re-insert
            if (product.prices && Array.isArray(product.prices)) {
                await runQuery('DELETE FROM product_prices WHERE product_id = ?', [id]);
                for (const p of product.prices) {
                    await runQuery(`
                        INSERT INTO product_prices (product_id, label, price, is_primary)
                        VALUES (?, ?, ?, ?)
                    `, [id, p.label, p.price, p.is_primary ? 1 : 0]);
                }
            }

            return true;
        });
    }

    async delete(id) {
        return await runQuery('DELETE FROM products WHERE id = ?', [id]);
    }
}

module.exports = new ProductRepository();
