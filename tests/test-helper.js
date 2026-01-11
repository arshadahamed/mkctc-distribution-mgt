const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { getDatabase, resetConnection } = require('../lib/db');

// Use memory for true isolation between test runs
process.env.DB_PATH = ':memory:';

async function initTestDb() {
    resetConnection();
    const db = getDatabase();

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('PRAGMA foreign_keys = OFF');

            const schema = [
                // SYSTEM
                `CREATE TABLE IF NOT EXISTS company_settings (id INTEGER PRIMARY KEY CHECK (id = 1), company_name TEXT DEFAULT 'Agro Distribution System', address TEXT, logo_url TEXT, favicon_url TEXT, contact_numbers TEXT, invoice_template TEXT DEFAULT 'classic', invoice_custom_config TEXT DEFAULT '{}', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT DEFAULT 'employee', permissions TEXT DEFAULT '[]', is_blocked INTEGER DEFAULT 0, token_version INTEGER DEFAULT 0, login_status TEXT DEFAULT 'offline', last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,

                // MASTER
                `CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`,
                `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`,
                `CREATE TABLE IF NOT EXISTS brands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`,
                `CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS sizes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS routes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT)`,
                `CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, address TEXT, contact TEXT, category TEXT, tags TEXT, tsr_name TEXT, area_manager_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT, contact TEXT, category TEXT, route_id INTEGER, credit_limit REAL DEFAULT 0, account_balance REAL DEFAULT 0, status TEXT DEFAULT 'active', latitude REAL, longitude REAL, is_deleted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, chemical_name TEXT, initial_stock REAL DEFAULT 0, department_id INTEGER, category_id INTEGER, brand_id INTEGER, supplier_id INTEGER, unit TEXT, size TEXT, units_per_carton INTEGER DEFAULT 1, cost REAL NOT NULL, msrp REAL NOT NULL, supplier_discount REAL DEFAULT 0, weighted INTEGER DEFAULT 0, reference_code TEXT UNIQUE, barcode TEXT UNIQUE, product_image TEXT, tags TEXT, status TEXT DEFAULT 'active', allow_free_issue INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS product_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, label TEXT, price REAL, is_primary INTEGER DEFAULT 0)`,
                `CREATE TABLE IF NOT EXISTS trucks (id INTEGER PRIMARY KEY AUTOINCREMENT, registration_number TEXT NOT NULL UNIQUE, driver_name TEXT, status TEXT DEFAULT 'active')`,

                // TRANSACTIONAL
                `CREATE TABLE IF NOT EXISTS truck_loads (id INTEGER PRIMARY KEY AUTOINCREMENT, load_date DATE NOT NULL, truck_id INTEGER NOT NULL, loaded_by INTEGER NOT NULL, status TEXT DEFAULT 'loaded', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS load_items (id INTEGER PRIMARY KEY AUTOINCREMENT, load_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity_loaded REAL NOT NULL)`,
                `CREATE TABLE IF NOT EXISTS truck_unloads (id INTEGER PRIMARY KEY AUTOINCREMENT, unload_date DATE NOT NULL, load_id INTEGER NOT NULL, truck_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS unload_items (id INTEGER PRIMARY KEY AUTOINCREMENT, unload_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity_remaining REAL NOT NULL, quantity_unloaded REAL NOT NULL, variance REAL DEFAULT 0, variance_reason TEXT)`,
                `CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, invoice_date DATE NOT NULL, customer_id INTEGER NOT NULL, bill_discount REAL DEFAULT 0, tax REAL DEFAULT 0, net_total REAL NOT NULL, payment_method TEXT DEFAULT 'cash', status TEXT DEFAULT 'completed', load_id INTEGER, payment_details TEXT, created_by INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, msrp REAL NOT NULL, discount_percentage REAL DEFAULT 0, discount_amount REAL DEFAULT 0, quantity REAL NOT NULL, is_free INTEGER DEFAULT 0, line_total REAL NOT NULL)`,
                `CREATE TABLE IF NOT EXISTS receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_number TEXT NOT NULL UNIQUE, receipt_date DATE NOT NULL, customer_id INTEGER NOT NULL, amount REAL NOT NULL, payment_type TEXT DEFAULT 'cash', receiver_name TEXT NOT NULL, collected_by INTEGER NOT NULL, receipt_category TEXT DEFAULT 'collection', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS receipt_allocations (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id INTEGER NOT NULL, invoice_id INTEGER NOT NULL, allocated_amount REAL NOT NULL)`,
                `CREATE TABLE IF NOT EXISTS cheque_details (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER, receipt_id INTEGER, cheque_number TEXT NOT NULL, cheque_date DATE NOT NULL, bank_name TEXT NOT NULL, amount REAL NOT NULL, cheque_image TEXT)`,
                `CREATE TABLE IF NOT EXISTS pre_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, customer_id INTEGER NOT NULL, order_date DATE NOT NULL, total_amount REAL NOT NULL, status TEXT DEFAULT 'pending', created_by INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS pre_order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, pre_order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity REAL NOT NULL, price REAL NOT NULL, line_total REAL NOT NULL)`,
                `CREATE TABLE IF NOT EXISTS customer_product_discounts (customer_id INTEGER NOT NULL, product_id INTEGER NOT NULL, discount_percentage REAL DEFAULT 0, discount_amount REAL DEFAULT 0, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (customer_id, product_id))`,
                `CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATE NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, reference_no TEXT, created_by INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS shop_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, visit_date DATE NOT NULL, customer_id INTEGER NOT NULL, route_id INTEGER NOT NULL, shop_status TEXT DEFAULT 'open', remarks TEXT, visited_by INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, table_name TEXT NOT NULL, record_id INTEGER, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,

                // RMA
                `CREATE TABLE IF NOT EXISTS rma_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, rma_number TEXT NOT NULL UNIQUE, customer_id INTEGER NOT NULL, invoice_id INTEGER, load_id INTEGER, request_date DATE NOT NULL, status TEXT DEFAULT 'pending', total_value REAL DEFAULT 0, remarks TEXT, handled_by INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS rma_items (id INTEGER PRIMARY KEY AUTOINCREMENT, rma_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity REAL NOT NULL, unit_price REAL NOT NULL, reason TEXT, condition TEXT, action_taken TEXT)`,
                `CREATE TABLE IF NOT EXISTS damaged_stock_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, rma_item_id INTEGER, quantity REAL NOT NULL, type TEXT NOT NULL, remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
            ];

            for (const sql of schema) {
                db.run(sql);
            }

            db.run(`INSERT OR IGNORE INTO company_settings (id, company_name) VALUES (1, 'Agro Distribution System')`);
            db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('backup_enabled', 'false')`);

            db.run('PRAGMA foreign_keys = ON');

            const adminPass = bcrypt.hashSync('admin', 10);
            db.run("INSERT OR IGNORE INTO users (name, username, password, role) VALUES ('Admin User', 'admin', '" + adminPass + "', 'admin')", (err) => {
                if (err) reject(err);
                else resolve(db);
            });
        });
    });
}

module.exports = { initTestDb };
