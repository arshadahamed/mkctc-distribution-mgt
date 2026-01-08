const express = require('express');
const router = express.Router();
const categoryRepo = require('../repositories/categoryRepo');

const { logEvent, logError } = require('../lib/logger');

router.get('/', async (req, res) => {
    try {
        const data = await categoryRepo.getAll();
        res.json({ success: true, data });
    } catch (e) {
        await logError(req.user?.id || 0, 'GET_CATEGORIES', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const id = await categoryRepo.create(req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_CATEGORY', 'categories', id, `Category ${req.body.name} created`);
        res.json({ success: true, data: { id } });
    } catch (e) {
        await logError(req.user?.id || 0, 'CREATE_CATEGORY', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await categoryRepo.update(req.params.id, req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_CATEGORY', 'categories', req.params.id, `Category ID ${req.params.id} updated to ${req.body.name}`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'UPDATE_CATEGORY', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await categoryRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_CATEGORY', 'categories', req.params.id, `Category ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'DELETE_CATEGORY', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
