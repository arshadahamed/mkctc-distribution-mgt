const { runQuery } = require('./lib/db');

async function migrate() {
    try {
        console.log('Starting migration for vehicles...');

        // Add new columns to trucks table
        const columnsToAdd = [
            { name: 'vehicle_type', type: 'TEXT' },
            { name: 'capacity', type: 'TEXT' },
            { name: 'fuel_type', type: 'TEXT' },
            { name: 'vehicle_image', type: 'TEXT' }
        ];

        for (const col of columnsToAdd) {
            try {
                await runQuery(`ALTER TABLE trucks ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Added column ${col.name}`);
            } catch (e) {
                if (e.message.includes('duplicate column name')) {
                    console.log(`Column ${col.name} already exists.`);
                } else {
                    throw e;
                }
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
