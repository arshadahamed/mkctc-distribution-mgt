const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database('D:/Freelance/MKC/agro_distribution.db');

db.all("PRAGMA table_info(products)", (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
