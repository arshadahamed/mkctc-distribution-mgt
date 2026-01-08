const { runQuery } = require('../lib/db');

async function addSampleSizes() {
    const sizes = [
        '50ml', '100ml', '200ml', '250ml', '400ml', '500ml', '1L', '2L', '5L',
        '50g', '100g', '250g', '500g', '1kg', '5kg', '10kg', '25kg', '50kg'
    ];

    console.log('Adding sample product sizes...\n');

    for (const size of sizes) {
        try {
            await runQuery('INSERT OR IGNORE INTO sizes (name) VALUES (?)', [size]);
            console.log(`✅ Added: ${size}`);
        } catch (error) {
            console.log(`❌ Error adding ${size}:`, error.message);
        }
    }

    console.log('\n✅ Sample sizes added successfully!');
    process.exit(0);
}

addSampleSizes().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
