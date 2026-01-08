const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Running Geospatial Migration...');

db.serialize(() => {
    // Add latitude and longitude columns to customers table if they don't exist
    db.run("ALTER TABLE customers ADD COLUMN latitude REAL", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ Latitude column already exists');
            } else {
                console.error('❌ Error adding latitude:', err.message);
            }
        } else {
            console.log('✅ Latitude column added');
        }
    });

    db.run("ALTER TABLE customers ADD COLUMN longitude REAL", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ Longitude column already exists');
            } else {
                console.error('❌ Error adding longitude:', err.message);
            }
        } else {
            console.log('✅ Longitude column added');
        }
    });

    // Provide some dummy coordinates for existing customers so the map isn't empty
    // Sample coordinates around Colombo, Sri Lanka (6.9271, 79.8612)
    const samples = [
        { id: 1, lat: 6.9271, lng: 79.8612 },
        { id: 2, lat: 6.9319, lng: 79.8478 },
        { id: 3, lat: 6.9147, lng: 79.8778 }
    ];

    samples.forEach(s => {
        db.run("UPDATE customers SET latitude = ?, longitude = ? WHERE id = ?", [s.lat, s.lng, s.id], (err) => {
            if (!err) console.log(`📍 Updated coordinates for customer ID ${s.id}`);
        });
    });

    console.log('🎉 Migration complete!');
});

db.close();
