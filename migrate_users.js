const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

const runQuery = (query) => {
    return new Promise((resolve, reject) => {
        db.run(query, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const migrate = async () => {
    try {
        console.log('Starting migration...');

        // Check if permissions column exists
        try {
            await runQuery(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'`);
            console.log('Added permissions column');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('permissions column already exists');
            } else {
                throw e;
            }
        }

        // Check if is_blocked column exists
        try {
            await runQuery(`ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0`);
            console.log('Added is_blocked column');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('is_blocked column already exists');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        db.close();
    }
};

migrate();
