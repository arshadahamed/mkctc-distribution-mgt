const { allQuery } = require('./lib/db');

async function checkLogs() {
    try {
        const logs = await allQuery('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20');
        console.log('Recent logs:');
        console.log(JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error fetching logs:', error);
    }
}

checkLogs();
