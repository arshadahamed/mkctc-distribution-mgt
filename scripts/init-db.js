const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🗄️  Initializing Database Schema...\n');

db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // --- SYSTEM TABLES ---
    db.run(`CREATE TABLE IF NOT EXISTS company_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name TEXT DEFAULT 'Agro Distribution System',
        address TEXT,
        logo_url TEXT,
        favicon_url TEXT,
        contact_numbers TEXT,
        invoice_template TEXT DEFAULT 'classic',
        invoice_custom_config TEXT DEFAULT '{}',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
        permissions TEXT DEFAULT '[]',
        is_blocked INTEGER DEFAULT 0,
        token_version INTEGER DEFAULT 0,
        login_status TEXT DEFAULT 'offline',
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- MASTER DATA ---
    db.run(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`);
    db.run(`CREATE TABLE IF NOT EXISTS brands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`);
    db.run(`CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS sizes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS routes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT)`);

    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT,
        contact TEXT,
        category TEXT,
        tags TEXT,
        tsr_name TEXT,
        area_manager_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        category TEXT,
        route_id INTEGER,
        credit_limit REAL DEFAULT 0,
        account_balance REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        latitude REAL,
        longitude REAL,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        chemical_name TEXT,
        initial_stock REAL DEFAULT 0,
        department_id INTEGER,
        category_id INTEGER,
        brand_id INTEGER,
        supplier_id INTEGER,
        unit TEXT,
        size TEXT,
        units_per_carton INTEGER DEFAULT 1,
        cost REAL NOT NULL,
        msrp REAL NOT NULL,
        supplier_discount REAL DEFAULT 0,
        weighted INTEGER DEFAULT 0,
        reference_code TEXT UNIQUE,
        barcode TEXT UNIQUE,
        product_image TEXT,
        tags TEXT,
        status TEXT DEFAULT 'active',
        allow_free_issue INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (brand_id) REFERENCES brands(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        label TEXT,
        price REAL,
        is_primary INTEGER DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS trucks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        registration_number TEXT NOT NULL UNIQUE,
        driver_name TEXT,
        status TEXT DEFAULT 'active'
    )`);

    // --- TRANSACTIONAL DATA ---
    db.run(`CREATE TABLE IF NOT EXISTS truck_loads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        load_date DATE NOT NULL,
        truck_id INTEGER NOT NULL,
        loaded_by INTEGER NOT NULL,
        status TEXT DEFAULT 'loaded',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (truck_id) REFERENCES trucks(id),
        FOREIGN KEY (loaded_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS load_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        load_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity_loaded REAL NOT NULL,
        FOREIGN KEY (load_id) REFERENCES truck_loads(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS truck_unloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unload_date DATE NOT NULL,
        load_id INTEGER NOT NULL,
        truck_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (load_id) REFERENCES truck_loads(id) ON DELETE CASCADE,
        FOREIGN KEY (truck_id) REFERENCES trucks(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS unload_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unload_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity_remaining REAL NOT NULL,
        quantity_unloaded REAL NOT NULL,
        variance REAL DEFAULT 0,
        variance_reason TEXT,
        FOREIGN KEY (unload_id) REFERENCES truck_unloads(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        invoice_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        bill_discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        net_total REAL NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'completed',
        load_id INTEGER,
        payment_details TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (load_id) REFERENCES truck_loads(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        msrp REAL NOT NULL,
        discount_percentage REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        quantity REAL NOT NULL,
        is_free INTEGER DEFAULT 0,
        line_total REAL NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        receipt_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_type TEXT DEFAULT 'cash',
        receiver_name TEXT NOT NULL,
        collected_by INTEGER NOT NULL,
        receipt_category TEXT DEFAULT 'collection',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (collected_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS receipt_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        invoice_id INTEGER NOT NULL,
        allocated_amount REAL NOT NULL,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cheque_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        receipt_id INTEGER,
        cheque_number TEXT NOT NULL,
        cheque_date DATE NOT NULL,
        bank_name TEXT NOT NULL,
        amount REAL NOT NULL,
        cheque_image TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (receipt_id) REFERENCES receipts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pre_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        order_date DATE NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pre_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pre_order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY (pre_order_id) REFERENCES pre_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customer_product_discounts (
        customer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        discount_percentage REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_id, product_id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        reference_no TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS shop_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        route_id INTEGER NOT NULL,
        shop_status TEXT DEFAULT 'open',
        remarks TEXT,
        visited_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (route_id) REFERENCES routes(id),
        FOREIGN KEY (visited_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // --- RMA & DAMAGED STOCK ---
    db.run(`CREATE TABLE IF NOT EXISTS rma_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rma_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        invoice_id INTEGER,
        load_id INTEGER,
        request_date DATE NOT NULL,
        status TEXT DEFAULT 'pending',
        total_value REAL DEFAULT 0,
        remarks TEXT,
        handled_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (handled_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rma_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rma_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        reason TEXT,
        condition TEXT,
        action_taken TEXT,
        FOREIGN KEY (rma_id) REFERENCES rma_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS damaged_stock_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        rma_item_id INTEGER,
        quantity REAL NOT NULL,
        type TEXT NOT NULL,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (rma_item_id) REFERENCES rma_items(id)
    )`);

    // --- INITIAL DATA ---
    console.log('✅ Tables created successfully\n');
    console.log('📦 Inserting sample data...\n');

    db.run(`INSERT OR IGNORE INTO company_settings (id, company_name) VALUES (1, 'Agro Distribution System')`);
    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('backup_enabled', 'false')`);

    db.run(`INSERT OR IGNORE INTO departments (name) VALUES ('Pesticides'), ('Fertilizers'), ('Seeds')`);
    db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Insecticides'), ('Herbicides'), ('Organic')`);
    db.run(`INSERT OR IGNORE INTO brands (name) VALUES ('AgroMax'), ('GreenLife'), ('CropGuard')`);
    db.run(`INSERT OR IGNORE INTO units (name) VALUES ('kg'), ('ltr'), ('pcs')`);
    db.run(`INSERT OR IGNORE INTO routes (name, description) VALUES ('Route A', 'North District'), ('Route B', 'South District')`);

    const adminPass = bcrypt.hashSync('admin', 10);
    const empPass = bcrypt.hashSync('emp123', 10);
    db.run(`INSERT OR IGNORE INTO users (name, username, password, role) VALUES ('Admin User', 'admin', '${adminPass}', 'admin')`);
    db.run(`INSERT OR IGNORE INTO users (name, username, password, role) VALUES ('Sales Rep 1', 'salesrep1', '${empPass}', 'employee')`);

    db.run(`INSERT OR IGNORE INTO products (name, description, department_id, category_id, brand_id, cost, msrp, barcode, reference_code) 
            VALUES ('Chlorpyrifos 20% EC', 'Effective insecticide', 1, 1, 1, 4500, 5500, 'BAR001', 'REF001')`);

    db.run(`INSERT OR IGNORE INTO customers (name, address, contact, category, route_id, account_balance) 
            VALUES ('General Cash Customer', 'Walk-in', '00000000', 'Cash', 1, 0)`);

    console.log('🎉 Database initialization complete!\n');
    db.close();
});
