const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Updating Users table schema...\n');

db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = OFF');

    // Check if columns exist first
    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            console.error('Error checking schema:', err);
            return;
        }

        const columnNames = columns.map(col => col.name);
        console.log('Current columns:', columnNames.join(', '));

        // Add permissions column if it doesn't exist
        if (!columnNames.includes('permissions')) {
            db.run(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'`, (err) => {
                if (err) {
                    console.error('Error adding permissions column:', err.message);
                } else {
                    console.log('✅ Added permissions column');
                }
            });
        } else {
            console.log('ℹ️  permissions column already exists');
        }

        // Add is_blocked column if it doesn't exist
        if (!columnNames.includes('is_blocked')) {
            db.run(`ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0`, (err) => {
                if (err) {
                    console.error('Error adding is_blocked column:', err.message);
                } else {
                    console.log('✅ Added is_blocked column');
                }
            });
        } else {
            console.log('ℹ️  is_blocked column already exists');
        }

        // Add token_version column if it doesn't exist (for JWT invalidation)
        if (!columnNames.includes('token_version')) {
            db.run(`ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0`, (err) => {
                if (err) {
                    console.error('Error adding token_version column:', err.message);
                } else {
                    console.log('✅ Added token_version column');
                }
            });
        } else {
            console.log('ℹ️  token_version column already exists');
        }

        // Update existing admin user with default permissions
        db.run(`
            UPDATE users 
            SET permissions = json('${JSON.stringify([
            "view_dashboard",
            "manage_products",
            "manage_customers",
            "manage_suppliers",
            "manage_distribution",
            "create_sales",
            "view_sales",
            "edit_sales",
            "delete_sales",
            "manage_payments",
            "manage_expenses",
            "view_reports",
            "manage_users",
            "manage_settings",
            "view_logs"
        ])}')
            WHERE role = 'admin' AND (permissions IS NULL OR permissions = '[]')
        `, (err) => {
            if (err) {
                console.error('Error updating admin permissions:', err.message);
            } else {
                console.log('✅ Updated admin user with full permissions');
            }
        });

        // Update existing employees with default permissions
        db.run(`
            UPDATE users 
            SET permissions = json('${JSON.stringify([
            "view_dashboard",
            "create_sales",
            "view_sales",
            "manage_payments"
        ])}')
            WHERE role = 'employee' AND (permissions IS NULL OR permissions = '[]')
        `, (err) => {
            if (err) {
                console.error('Error updating employee permissions:', err.message);
            } else {
                console.log('✅ Updated employee users with default permissions');
            }

            // Re-enable foreign keys
            db.run('PRAGMA foreign_keys = ON');

            console.log('\n🎉 Users table schema update complete!\n');

            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('✅ Database closed successfully');
                }
            });
        });
    });
});
