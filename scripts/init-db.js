const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🗄️  Initializing Database Schema...\n');

db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create Suppliers table
    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        category TEXT,
        tags TEXT,
        tsr_name TEXT,
        area_manager_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Departments table
    db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);

    // Create Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);

    // Create Brands table
    db.run(`CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);

    // Create Units table
    db.run(`CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Sizes table
    db.run(`CREATE TABLE IF NOT EXISTS sizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        department_id INTEGER,
        category_id INTEGER,
        brand_id INTEGER,
        supplier_id INTEGER,
        unit TEXT,
        units_per_carton INTEGER DEFAULT 1,
        cost REAL NOT NULL,
        msrp REAL NOT NULL,
        supplier_discount REAL DEFAULT 0,
        weighted BOOLEAN DEFAULT 0,
        reference_code TEXT UNIQUE,
        barcode TEXT UNIQUE,
        product_image TEXT,
        tags TEXT,
        chemical_name TEXT,
        initial_stock REAL DEFAULT 0,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        size_id INTEGER,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (brand_id) REFERENCES brands(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (size_id) REFERENCES sizes(id)
    )`);

    // Create Routes table
    db.run(`CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    )`);

    // Create Customers table
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        category TEXT,
        route_id INTEGER,
        account_balance REAL DEFAULT 0,
        status TEXT CHECK(status IN ('active', 'blocked')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    // Create Trucks table
    db.run(`CREATE TABLE IF NOT EXISTS trucks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        registration_number TEXT NOT NULL UNIQUE,
        driver_name TEXT,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active'
    )`);

    // Create Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
        login_status TEXT CHECK(login_status IN ('online', 'offline')) DEFAULT 'offline',
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Truck Loads table
    db.run(`CREATE TABLE IF NOT EXISTS truck_loads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        load_date DATE NOT NULL,
        truck_id INTEGER NOT NULL,
        loaded_by INTEGER NOT NULL,
        status TEXT CHECK(status IN ('loaded', 'unloaded')) DEFAULT 'loaded',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (truck_id) REFERENCES trucks(id),
        FOREIGN KEY (loaded_by) REFERENCES users(id)
    )`);

    // Create Load Items table
    db.run(`CREATE TABLE IF NOT EXISTS load_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        load_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity_loaded REAL NOT NULL,
        FOREIGN KEY (load_id) REFERENCES truck_loads(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Create Truck Unloads table
    db.run(`CREATE TABLE IF NOT EXISTS truck_unloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unload_date DATE NOT NULL,
        load_id INTEGER NOT NULL,
        truck_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (load_id) REFERENCES truck_loads(id) ON DELETE CASCADE,
        FOREIGN KEY (truck_id) REFERENCES trucks(id)
    )`);

    // Create Unload Items table
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

    // Create Invoices table
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        invoice_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        bill_discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        net_total REAL NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('cash', 'cheque', 'account', 'split', 'pending')) DEFAULT 'cash',
        status TEXT CHECK(status IN ('completed', 'held', 'cancelled')) DEFAULT 'completed',
        load_id INTEGER,
        payment_details TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (load_id) REFERENCES truck_loads(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    // Create Invoice Items table
    db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        msrp REAL NOT NULL,
        discount_percentage REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        quantity REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Create Cheque Details table
    db.run(`CREATE TABLE IF NOT EXISTS cheque_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        receipt_id INTEGER,
        cheque_number TEXT NOT NULL,
        cheque_date DATE NOT NULL,
        bank_name TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (receipt_id) REFERENCES receipts(id)
    )`);

    // Create Receipts table
    db.run(`CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        receipt_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_type TEXT CHECK(payment_type IN ('cash', 'cheque')) DEFAULT 'cash',
        receiver_name TEXT NOT NULL,
        collected_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (collected_by) REFERENCES users(id)
    )`);

    // Create Receipt Allocations table
    db.run(`CREATE TABLE IF NOT EXISTS receipt_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        invoice_id INTEGER NOT NULL,
        allocated_amount REAL NOT NULL,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    )`);

    // Create Shop Visits table
    db.run(`CREATE TABLE IF NOT EXISTS shop_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        route_id INTEGER NOT NULL,
        shop_status TEXT CHECK(shop_status IN ('open', 'closed')) DEFAULT 'open',
        remarks TEXT,
        visited_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (route_id) REFERENCES routes(id),
        FOREIGN KEY (visited_by) REFERENCES users(id)
    )`);

    // Create Audit Logs table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Create customer_product_discounts table (Last Invoice Discount memory)
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

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customers_route ON customers(route_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipts(customer_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_shop_visits_date ON shop_visits(visit_date)`);

    console.log('✅ Tables created successfully\n');
    console.log('📦 Inserting sample data...\n');

    // Insert sample data
    db.run(`INSERT OR IGNORE INTO departments (name) VALUES ('Pesticides')`);
    db.run(`INSERT OR IGNORE INTO departments (name) VALUES ('Fertilizers')`);
    db.run(`INSERT OR IGNORE INTO departments (name) VALUES ('Seeds')`);

    db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Insecticides')`);
    db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Herbicides')`);
    db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('Organic')`);

    db.run(`INSERT OR IGNORE INTO brands (name) VALUES ('AgroMax')`);
    db.run(`INSERT OR IGNORE INTO brands (name) VALUES ('GreenLife')`);
    db.run(`INSERT OR IGNORE INTO brands (name) VALUES ('CropGuard')`);

    db.run(`INSERT OR IGNORE INTO units (name) VALUES ('kg')`);
    db.run(`INSERT OR IGNORE INTO units (name) VALUES ('ltr')`);
    db.run(`INSERT OR IGNORE INTO units (name) VALUES ('pcs')`);

    db.run(`INSERT OR IGNORE INTO suppliers (name, address, contact) VALUES ('AgriSupply Co.', '123 Farm Road, Colombo', '+94-712345678')`);

    db.run(`INSERT OR IGNORE INTO routes (name, description) VALUES ('Route A', 'North District')`);
    db.run(`INSERT OR IGNORE INTO routes (name, description) VALUES ('Route B', 'South District')`);

    db.run(`INSERT OR IGNORE INTO trucks (registration_number, driver_name) VALUES ('WP-01-AB-1234', 'Kamal Perera')`);
    db.run(`INSERT OR IGNORE INTO trucks (registration_number, driver_name) VALUES ('WP-02-CD-5678', 'Sunil Silva')`);

    const bcrypt = require('bcryptjs');
    const adminPass = bcrypt.hashSync('admin123', 10);
    const empPass = bcrypt.hashSync('emp123', 10);

    db.run(`INSERT OR IGNORE INTO users (name, username, password, role) VALUES ('Admin User', 'admin', '${adminPass}', 'admin')`);
    db.run(`INSERT OR IGNORE INTO users (name, username, password, role) VALUES ('Sales Rep 1', 'salesrep1', '${empPass}', 'employee')`);

    db.run(`INSERT OR IGNORE INTO products (name, description, department_id, category_id, brand_id, supplier_id, unit, cost, msrp, barcode, reference_code) 
            VALUES ('Chlorpyrifos 20% EC', 'Effective insecticide', 1, 1, 1, 1, 'ltr', 4500, 5500, 'BAR001', 'REF001')`);
    db.run(`INSERT OR IGNORE INTO products (name, description, department_id, category_id, brand_id, supplier_id, unit, cost, msrp, barcode, reference_code) 
            VALUES ('Glyphosate 41% SL', 'Broad spectrum herbicide', 1, 2, 2, 1, 'ltr', 2800, 3500, 'BAR002', 'REF002')`);
    db.run(`INSERT OR IGNORE INTO products (name, description, department_id, category_id, brand_id, supplier_id, unit, cost, msrp, barcode, reference_code) 
            VALUES ('NPK 19:19:19', 'Water soluble fertilizer', 2, 3, 3, 1, 'kg', 850, 1200, 'BAR003', 'REF003')`);

    db.run(`INSERT OR IGNORE INTO customers (name, address, contact, category, route_id, account_balance) 
            VALUES ('General Cash Customer', 'Walk-in', '00000000', 'Cash', 1, 0)`);

    db.run(`INSERT OR IGNORE INTO customers (name, address, contact, category, route_id, account_balance) 
            VALUES ('Lanka Agri Store', 'Colombo Street', '+94-778877665', 'Retailer', 1, 50000)`);
    db.run(`INSERT OR IGNORE INTO customers (name, address, contact, category, route_id, account_balance) 
            VALUES ('Kisan Seva', 'Kandy Road', '+94-717654321', 'Distributor', 1, 120000)`, () => {
        console.log('✅ Sample data inserted\n');
        console.log('🎉 Database initialization complete!\n');
        console.log('📊 Database location:', dbPath);

        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('\n✅ Database closed successfully');
            }
        });
    });
});
