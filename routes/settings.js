const express = require('express');
const router = express.Router();
const settingsRepo = require('../repositories/settingsRepo');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { logEvent, logError } = require('../lib/logger');

router.get('/company', async (req, res) => {
    try {
        const details = await settingsRepo.getCompanyDetails();
        res.json({ success: true, data: details });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_COMPANY_DETAILS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/company', isAuthenticated, isAdmin, async (req, res) => {
    try {
        await settingsRepo.updateCompanyDetails(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_COMPANY_SETTINGS', 'company_settings', 1, `Company settings updated`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_COMPANY_SETTINGS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/reset-data', isAuthenticated, isAdmin, async (req, res) => {
    try {
        await settingsRepo.resetTransactionalData();
        const userId = req.user?.id || 0;
        // Log this safely even though we just cleared logs (it will be the first new log!)
        await logEvent(userId, 'RESET_DATA', 'system', 1, `Administrator reset all transactional data`);
        res.json({ success: true, message: 'All transactional data has been reset.' });
    } catch (error) {
        await logError(req.user?.id || 0, 'RESET_DATA', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/key/:key', isAuthenticated, async (req, res) => {
    try {
        const val = await settingsRepo.getSetting(req.params.key);
        res.json({ success: true, data: val });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_SETTING', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/key/:key', isAuthenticated, isAdmin, async (req, res) => {
    try {
        await settingsRepo.saveSetting(req.params.key, req.body.value);
        await logEvent(req.user?.id || 0, 'UPDATE_SETTING', 'app_settings', 0, `Updated setting: ${req.params.key}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_SETTING', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

router.post('/run-query', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { sql } = req.body;
        if (!sql) throw new Error('Query cannot be empty');

        // Log sensitive action
        await logEvent(req.user?.id || 0, 'RUN_SQL', 'system', 0, `Executed: ${sql.substring(0, 100)}...`);

        const rows = await settingsRepo.executeQuery(sql);
        res.json({ success: true, data: rows });
    } catch (error) {
        await logError(req.user?.id || 0, 'RUN_SQL_QUERY', error);
        res.status(500).json({ success: false, error: 'SQL Error: ' + error.message });
    }
});
