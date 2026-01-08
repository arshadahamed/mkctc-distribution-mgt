const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

const migrate = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Rename existing table
            db.run("ALTER TABLE products RENAME TO products_old", (err) => {
                if (err) return reject("Error renaming table: " + err.message);

                // 2. Create new table without the strict unit constraint
                const createTableSql = `
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
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (department_id) REFERENCES departments(id),
                        FOREIGN KEY (category_id) REFERENCES categories(id),
                        FOREIGN KEY (brand_id) REFERENCES brands(id),
                        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
                    )
                `;

                db.run(createTableSql, (err) => {
                    if (err) return reject("Error creating new table: " + err.message);

                    // 3. Copy data from old table to new table
                    // We map columns to ensure they match the new order/schema
                    const copyDataSql = `
                        INSERT INTO products (
                            id, name, description, department_id, category_id, brand_id, supplier_id, 
                            unit, units_per_carton, cost, msrp, supplier_discount, weighted, 
                            reference_code, barcode, product_image, tags, chemical_name, initial_stock, 
                            status, created_at
                        )
                        SELECT 
                            id, name, description, department_id, category_id, brand_id, supplier_id, 
                            unit, units_per_carton, cost, msrp, supplier_discount, weighted, 
                            reference_code, barcode, product_image, tags, chemical_name, initial_stock, 
                            status, created_at
                        FROM products_old
                    `;

                    db.run(copyDataSql, (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return reject("Error copying data: " + err.message);
                        }

                        // 4. Drop old table
                        db.run("DROP TABLE products_old", (err) => {
                            if (err) return reject("Error dropping old table: " + err.message);

                            db.run("COMMIT", (err) => {
                                if (err) return reject("Error committing transaction: " + err.message);
                                console.log("✅ Migration successful: Strict unit constraint removed.");
                                resolve();
                            });
                        });
                    });
                });
            });
        });
    });
};

migrate().then(() => db.close()).catch(err => {
    console.error(err);
    db.run("ROLLBACK");
    db.close();
});
