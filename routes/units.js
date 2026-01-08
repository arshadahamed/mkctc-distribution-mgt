const express = require('express');
const router = express.Router();
const unitRepo = require('../repositories/unitRepo');

const { logEvent, logError } = require('../lib/logger');

router.get('/', async (req, res) => {
    try {
        const data = await unitRepo.getAll();
        res.json({ success: true, data });
    } catch (e) {
        await logError(req.user?.id || 0, 'GET_UNITS', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const id = await unitRepo.create(req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_UNIT', 'units', id, `Unit ${req.body.name} created`);
        res.json({ success: true, data: { id } });
    } catch (e) {
        await logError(req.user?.id || 0, 'CREATE_UNIT', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await unitRepo.update(req.params.id, req.body.name);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_UNIT', 'units', req.params.id, `Unit ID ${req.params.id} updated to ${req.body.name}`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'UPDATE_UNIT', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await unitRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_UNIT', 'units', req.params.id, `Unit ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'DELETE_UNIT', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
