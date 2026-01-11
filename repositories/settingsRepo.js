const { getQuery, runQuery, transaction, allQuery } = require('../lib/db');

const SettingsRepository = {
    async getCompanyDetails() {
        return await getQuery('SELECT * FROM company_settings WHERE id = 1');
    },

    async updateCompanyDetails(data) {
        const sql = `
            UPDATE company_settings SET 
                company_name = ?, 
                address = ?, 
                logo_url = ?, 
                favicon_url = ?, 
                contact_numbers = ?, 
                invoice_template = ?,
                invoice_custom_config = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `;
        const params = [
            data.company_name,
            data.address,
            data.logo_url,
            data.favicon_url,
            data.contact_numbers,
            data.invoice_template || 'classic',
            data.invoice_custom_config || '{}'
        ];
        return await runQuery(sql, params);
    },

    async resetTransactionalData() {
        // Disable foreign keys temporarily for a clean wipe
        // Note: Foreign keys MUST be disabled OUTSIDE of a transaction block in SQLite
        await runQuery('PRAGMA foreign_keys = OFF');

        try {
            return await transaction(async () => {
                // Transactional & Operation Data
                await runQuery('DELETE FROM invoice_items');
                await runQuery('DELETE FROM invoices');
                await runQuery('DELETE FROM receipt_allocations');
                await runQuery('DELETE FROM receipts');
                await runQuery('DELETE FROM cheque_details');
                await runQuery('DELETE FROM shop_visits');
                await runQuery('DELETE FROM expenses');
                await runQuery('DELETE FROM audit_logs');
                await runQuery('DELETE FROM pre_order_items');
                await runQuery('DELETE FROM pre_orders');
                await runQuery('DELETE FROM customer_product_discounts');
                await runQuery('DELETE FROM rma_items');
                await runQuery('DELETE FROM rma_requests');
                await runQuery('DELETE FROM damaged_stock_ledger');

                // Distribution Data
                await runQuery('DELETE FROM unload_items');
                await runQuery('DELETE FROM truck_unloads');
                await runQuery('DELETE FROM load_items');
                await runQuery('DELETE FROM truck_loads');
                await runQuery('DELETE FROM trucks');

                // Master Data
                await runQuery('DELETE FROM product_prices');
                await runQuery('DELETE FROM products');
                await runQuery('DELETE FROM customers');
                await runQuery('DELETE FROM suppliers');
                await runQuery('DELETE FROM routes');
                await runQuery('DELETE FROM brands');
                await runQuery('DELETE FROM categories');
                await runQuery('DELETE FROM departments');
                await runQuery('DELETE FROM units');
                await runQuery('DELETE FROM sizes');

                // Reset IDs (sqlite_sequence) for all tables except users, company_settings, etc.
                await runQuery("DELETE FROM sqlite_sequence WHERE name NOT IN ('users', 'company_settings', 'app_settings')");

                return true;
            });
        } finally {
            // Always re-enable foreign keys after the transaction is settled
            await runQuery('PRAGMA foreign_keys = ON');
        }
    },

    async getSetting(key) {
        const row = await getQuery('SELECT value FROM app_settings WHERE key = ?', [key]);
        if (!row) return null;
        try {
            return JSON.parse(row.value);
        } catch (e) {
            return row.value;
        }
    },

    async saveSetting(key, value) {
        const sql = `
            INSERT INTO app_settings (key, value, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET 
                value = excluded.value, 
                updated_at = excluded.updated_at
        `;
        return await runQuery(sql, [key, JSON.stringify(value)]);
    },

    async get(key) { return await this.getSetting(key); },
    async set(key, value) { return await this.saveSetting(key, value); },

    async executeQuery(sql, params = []) {
        console.log('Running Raw SQL:', sql);
        return await allQuery(sql, params);
    }
};

module.exports = SettingsRepository;
