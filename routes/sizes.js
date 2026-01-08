const express = require('express');
const router = express.Router();
const sizeRepo = require('../repositories/sizeRepo');

const { logEvent, logError } = require('../lib/logger');

router.get('/', async (req, res) => {
    try {
        const data = await sizeRepo.getAll();
        res.json({ success: true, data });
    } catch (e) {
        await logError(req.user?.id || 0, 'GET_SIZES', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const id = await sizeRepo.create(req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_SIZE', 'sizes', id, `Size ${req.body.name} created`);
        res.json({ success: true, data: { id } });
    } catch (e) {
        await logError(req.user?.id || 0, 'CREATE_SIZE', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await sizeRepo.update(req.params.id, req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_SIZE', 'sizes', req.params.id, `Size ID ${req.params.id} updated to ${req.body.name}`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'UPDATE_SIZE', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await sizeRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_SIZE', 'sizes', req.params.id, `Size ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'DELETE_SIZE', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
