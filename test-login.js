const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('agro_distribution.db');

db.get('SELECT password FROM users WHERE username = ?', ['admin'], async (err, row) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('Testing login for "admin"');
    console.log('Hash in DB:', row.password);
    const match = await bcrypt.compare('admin', row.password);
    console.log('Match result:', match);
    db.close();
});
