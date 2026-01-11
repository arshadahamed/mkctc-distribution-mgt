const { getQuery } = require('./lib/db');

async function checkUsersSchema() {
    try {
        const schema = await getQuery("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
        console.log('Users table schema:');
        console.log(schema.sql);
    } catch (error) {
        console.error('Error fetching schema:', error);
    }
}

checkUsersSchema();
