const { runQuery } = require('../lib/db');

/**
 * Log an event to the audit_logs table
 * @param {number} userId - ID of the user performing the action
 * @param {string} action - Action description (e.g., 'LOGIN', 'CREATE_PRODUCT')
 * @param {string} tableName - Table affected
 * @param {number|string} recordId - ID of the record affected
 * @param {object|string} details - Additional details (JSON or string)
 */
async function logEvent(userId, action, tableName, recordId = null, details = null) {
    try {
        const safeUserId = userId > 0 ? userId : 1;
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
        await runQuery(
            'INSERT INTO audit_logs (user_id, action, table_name, record_id, details) VALUES (?, ?, ?, ?, ?)',
            [safeUserId, action, tableName, recordId, detailsStr]
        );
    } catch (err) {
        console.error('Logging Error:', err);
    }
}

/**
 * Log an error to the audit_logs table
 * @param {number} userId - ID of the user (if available)
 * @param {string} context - Where the error happened (e.g., 'API_PUT_PRODUCT')
 * @param {Error} error - The error object
 */
async function logError(userId, context, error) {
    await logEvent(userId || 0, 'ERROR', context, null, {
        message: error.message,
        stack: error.stack
    });
}

module.exports = { logEvent, logError };
