const { allQuery } = require('./lib/db');

async function checkUsers() {
    try {
        const users = await allQuery('SELECT id, username, role, is_blocked, login_status, token_version FROM users');
        console.log('Users in database:');
        console.log(JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

checkUsers();
