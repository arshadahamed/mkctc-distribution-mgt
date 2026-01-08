const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const settingsRepo = require('../repositories/settingsRepo');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const path = require('path');
const { logEvent, logError } = require('../lib/logger');

// Get backup configuration
router.get('/config', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const config = {
            enabled: await settingsRepo.get('backup_enabled') === 'true',
            frequency: await settingsRepo.get('backup_frequency') || 'daily',
            time: await settingsRepo.get('backup_time') || '23:00',
            retention: parseInt(await settingsRepo.get('backup_retention') || '10')
        };
        res.json({ success: true, data: config });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_BACKUP_CONFIG', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update backup configuration
router.put('/config', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { enabled, frequency, time, retention } = req.body;

        await settingsRepo.set('backup_enabled', enabled ? 'true' : 'false');
        await settingsRepo.set('backup_frequency', frequency);
        await settingsRepo.set('backup_time', time);
        await settingsRepo.set('backup_retention', retention.toString());

        // Restart scheduler
        await backupService.initScheduler();

        await logEvent(req.user?.id || 0, 'UPDATE_BACKUP_CONFIG', 'app_settings', 0, `Backup settings updated (Enabled: ${enabled})`);
        res.json({ success: true, message: 'Backup settings updated' });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_BACKUP_CONFIG', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// List backups
router.get('/list', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const backups = await backupService.listBackups();
        res.json({ success: true, data: backups });
    } catch (error) {
        await logError(req.user?.id || 0, 'LIST_BACKUPS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Trigger manual backup
router.post('/manual', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await backupService.performBackup('manual', req.user.id);
        if (result.success) {
            await logEvent(req.user.id, 'MANUAL_BACKUP', 'system', 0, `Manual backup created: ${result.fileName}`);
            res.json({ success: true, message: 'Backup created successfully', file: result.fileName });
        } else {
            await logError(req.user.id, 'MANUAL_BACKUP', new Error(result.error));
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        await logError(req.user?.id || 0, 'MANUAL_BACKUP', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Download backup
router.get('/download/:filename', isAuthenticated, isAdmin, (req, res) => {
    const filename = req.params.filename;
    // Basic path traversal protection
    if (filename.includes('..') || !filename.endsWith('.db')) {
        return res.status(400).send('Invalid filename');
    }

    const filepath = path.join(__dirname, '..', 'backups', filename);
    res.download(filepath, filename);
});

module.exports = router;
