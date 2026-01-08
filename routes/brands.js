const express = require('express');
const router = express.Router();
const brandRepo = require('../repositories/brandRepo');

const { logEvent, logError } = require('../lib/logger');

router.get('/', async (req, res) => {
    try {
        const data = await brandRepo.getAll();
        res.json({ success: true, data });
    } catch (e) {
        await logError(req.user?.id || 0, 'GET_BRANDS', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const id = await brandRepo.create(req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_BRAND', 'brands', id, `Brand ${req.body.name} created`);
        res.json({ success: true, data: { id } });
    } catch (e) {
        await logError(req.user?.id || 0, 'CREATE_BRAND', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await brandRepo.update(req.params.id, req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_BRAND', 'brands', req.params.id, `Brand ID ${req.params.id} updated to ${req.body.name}`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'UPDATE_BRAND', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await brandRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_BRAND', 'brands', req.params.id, `Brand ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'DELETE_BRAND', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
