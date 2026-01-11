const bcrypt = require('bcryptjs');
const { getQuery } = require('./lib/db');

async function testPassword(username, password) {
    try {
        const user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            console.log(`User ${username} not found`);
            return;
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (isValid) {
            console.log(`Password for ${username} is CORRECT`);
        } else {
            console.log(`Password for ${username} is INCORRECT`);
        }
    } catch (error) {
        console.error('Error testing password:', error);
    }
}

testPassword('admin', 'admin');
testPassword('arshad', 'admin');
testPassword('salesrep1', 'salesrep1');
testPassword('salesrep1', '1234');
