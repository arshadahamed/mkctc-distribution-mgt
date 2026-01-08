const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'agro_distribution.db');
const db = new sqlite3.Database(dbPath);

const id = process.argv[2];

if (!id) {
    console.log('Please provide a load ID');
    process.exit(1);
}

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    console.log(`Checking details for Load ID: ${id}`);

    db.all('SELECT id FROM truck_unloads WHERE load_id = ?', [id], (err, unloads) => {
        if (err) throw err;
        console.log('Found unloads:', unloads);

        unloads.forEach(u => {
            db.all('SELECT id FROM unload_items WHERE unload_id = ?', [u.id], (err, items) => {
                if (err) throw err;
                console.log(`Unload ${u.id} has items:`, items);
            });
        });

        db.all('SELECT id FROM load_items WHERE load_id = ?', [id], (err, items) => {
            if (err) throw err;
            console.log('Found load items:', items);
        });
    });

    console.log('\nAttempting deletion...');

    // Trial deletion of one thing at a time
    db.run('DELETE FROM unload_items WHERE unload_id IN (SELECT id FROM truck_unloads WHERE load_id = ?)', [id], function (err) {
        if (err) console.error('Error deleting unload_items:', err.message);
        else console.log(`Deleted ${this.changes} unload_items`);

        db.run('DELETE FROM truck_unloads WHERE load_id = ?', [id], function (err) {
            if (err) console.error('Error deleting truck_unloads:', err.message);
            else console.log(`Deleted ${this.changes} truck_unloads`);

            db.run('DELETE FROM load_items WHERE load_id = ?', [id], function (err) {
                if (err) console.error('Error deleting load_items:', err.message);
                else console.log(`Deleted ${this.changes} load_items`);

                db.run('DELETE FROM truck_loads WHERE id = ?', [id], function (err) {
                    if (err) console.error('Error deleting truck_loads:', err.message);
                    else console.log(`Deleted truck_loads success!`);
                    db.close();
                });
            });
        });
    });
});
