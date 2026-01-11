const { allQuery } = require('./lib/db');

async function checkFailedLogins() {
    try {
        const logs = await allQuery("SELECT * FROM audit_logs WHERE action LIKE 'LOGIN_FAILED' ORDER BY created_at DESC LIMIT 20");
        console.log('Recent failed login attempts:');
        console.log(JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error fetching logs:', error);
    }
}

checkFailedLogins();
