const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Migrating passwords to hashed format...');

db.serialize(() => {
    db.all('SELECT id, password FROM users', [], async (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return;
        }

        for (const row of rows) {
            // Check if already hashed (bcrypt hashes start with $2a$ or $2b$)
            if (row.password && (row.password.startsWith('$2a$') || row.password.startsWith('$2b$'))) {
                console.log(`User ID ${row.id}: Password already hashed. Skipping.`);
                continue;
            }

            console.log(`User ID ${row.id}: Hashing password...`);
            const hashedPassword = await bcrypt.hash(row.password, 10);

            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, row.id], (updErr) => {
                if (updErr) console.error(`Failed to update User ID ${row.id}:`, updErr);
            });
        }

        console.log('\n✅ Migration triggered for all users.');
        console.log('Closing database in 2 seconds...');
        setTimeout(() => db.close(), 2000);
    });
});
