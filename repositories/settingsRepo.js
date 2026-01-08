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
        return await transaction(async () => {
            await runQuery('DELETE FROM invoice_items');
            await runQuery('DELETE FROM receipt_allocations');
            await runQuery('DELETE FROM truck_load_items');
            await runQuery('DELETE FROM invoices');
            await runQuery('DELETE FROM receipts');
            await runQuery('DELETE FROM shop_visits');
            await runQuery('DELETE FROM truck_loads');
            await runQuery('DELETE FROM expenses');
            await runQuery('DELETE FROM audit_logs');
            await runQuery('UPDATE customers SET account_balance = 0');
            return true;
        });
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
