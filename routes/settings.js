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
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const settings = await settingsRepo.getAllSettings();
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await settingsRepo.saveSetting(key, value);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/test-sms', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const notificationService = require('../services/notificationService');
        const { phone } = req.body;

        if (!phone) throw new Error('Recipient phone number is required');

        const success = await notificationService.sendSMS(phone, 'MKC System: This is a gateway test pulse. Your communication pipeline is ACTIVE.');

        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false, message: 'Gateway rejected the transmission. Check logs for details.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/test-email', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const nodemailer = require('nodemailer');
        const { host, port, user, pass } = req.body;

        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port) || 587,
            secure: port == 465,
            auth: { user, pass }
        });

        await transporter.verify();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

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

module.exports = router;
