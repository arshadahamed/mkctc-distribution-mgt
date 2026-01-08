CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , category TEXT, tags TEXT, area_manager_name TEXT, tsr_name TEXT);

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

CREATE TABLE brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

CREATE TABLE routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );

CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        category TEXT,
        route_id INTEGER,
        account_balance REAL DEFAULT 0,
        status TEXT CHECK(status IN ('active', 'blocked')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, credit_limit REAL DEFAULT 0, is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY (route_id) REFERENCES routes(id)
    );

CREATE TABLE trucks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        registration_number TEXT NOT NULL UNIQUE,
        driver_name TEXT,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active'
    , vehicle_type TEXT, capacity TEXT, fuel_type TEXT, vehicle_image TEXT);

CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
        login_status TEXT CHECK(login_status IN ('online', 'offline')) DEFAULT 'offline',
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , permissions TEXT DEFAULT '[]', is_blocked INTEGER DEFAULT 0, token_version INTEGER DEFAULT 0);

CREATE TABLE truck_loads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        load_date DATE NOT NULL,
        truck_id INTEGER NOT NULL,
        loaded_by INTEGER NOT NULL,
        status TEXT CHECK(status IN ('loaded', 'unloaded')) DEFAULT 'loaded',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (truck_id) REFERENCES trucks(id),
        FOREIGN KEY (loaded_by) REFERENCES users(id)
    );

CREATE TABLE truck_unloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unload_date DATE NOT NULL,
        load_id INTEGER NOT NULL,
        truck_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (load_id) REFERENCES truck_loads(id),
        FOREIGN KEY (truck_id) REFERENCES trucks(id)
    );

CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        invoice_date DATE NOT NULL,
        customer_id INTEGER NOT NULL,
        bill_discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        net_total REAL NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('cash', 'cheque', 'account')) DEFAULT 'cash',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );

CREATE TABLE cheque_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        receipt_id INTEGER,
        cheque_number TEXT NOT NULL,
        cheque_date DATE NOT NULL,
        bank_name TEXT NOT NULL,
        amount REAL NOT NULL, cheque_image TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (receipt_id) REFERENCES receipts(id)
    );

CREATE TABLE receipts (
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
    );

CREATE TABLE receipt_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        invoice_id INTEGER NOT NULL,
        allocated_amount REAL NOT NULL,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

CREATE TABLE shop_visits (
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
    );

CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

CREATE INDEX idx_customers_route ON customers(route_id);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);

CREATE INDEX idx_invoices_date ON invoices(invoice_date);

CREATE INDEX idx_receipts_customer ON receipts(customer_id);

CREATE INDEX idx_shop_visits_date ON shop_visits(visit_date);

CREATE TABLE units (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE products (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        description TEXT,
                        department_id INTEGER,
                        category_id INTEGER,
                        brand_id INTEGER,
                        supplier_id INTEGER,
                        unit TEXT DEFAULT 'pcs',
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
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, size_id INTEGER REFERENCES sizes(id), size TEXT,
                        FOREIGN KEY (department_id) REFERENCES departments(id),
                        FOREIGN KEY (category_id) REFERENCES categories(id),
                        FOREIGN KEY (brand_id) REFERENCES brands(id),
                        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
                    );

CREATE TABLE sizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

CREATE TABLE product_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            price REAL NOT NULL,
            is_primary INTEGER DEFAULT 0,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );

CREATE TABLE company_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                company_name TEXT,
                address TEXT,
                logo_url TEXT,
                favicon_url TEXT,
                contact_numbers TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        reference_no TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE load_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    load_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity_loaded REAL NOT NULL,
                    FOREIGN KEY (load_id) REFERENCES truck_loads(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id)
                );

CREATE TABLE unload_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unload_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity_remaining REAL NOT NULL,
                quantity_unloaded REAL NOT NULL,
                variance REAL DEFAULT 0,
                variance_reason TEXT,
                FOREIGN KEY (unload_id) REFERENCES truck_unloads(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

CREATE TABLE invoice_items (
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
            );

