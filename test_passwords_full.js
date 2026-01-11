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
        console.log(`Testing ${username} with ${password}: ${isValid ? 'CORRECT ✅' : 'INCORRECT ❌'}`);
    } catch (error) {
        console.error('Error testing password:', error);
    }
}

async function runTests() {
    console.log('--- ADMIN TESTS ---');
    await testPassword('admin', 'admin');
    await testPassword('admin', 'admin123');
    await testPassword('admin', 'password');

    console.log('\n--- SALESREP TESTS ---');
    await testPassword('salesrep1', 'emp123');
    await testPassword('salesrep1', 'salesrep1');
    await testPassword('salesrep1', '1234');

    console.log('\n--- ARSHAD TESTS ---');
    await testPassword('arshad', 'admin');
    await testPassword('arshad', 'arshad');
}

runTests();
