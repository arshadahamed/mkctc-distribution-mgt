const { runQuery, allQuery } = require('./lib/db');

(async () => {
    try {
        console.log('Adding token_version column to users table...');

        // Check if column exists
        const cols = await allQuery("PRAGMA table_info(users)");
        const hasCol = cols.some(c => c.name === 'token_version');

        if (!hasCol) {
            await runQuery('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0');
            console.log('✅ token_version column added.');
        } else {
            console.log('ℹ️ token_version column already exists.');
        }

    } catch (e) {
        console.error('Migration Failed:', e);
    }
})();
