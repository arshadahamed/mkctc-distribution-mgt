const express = require('express');
const router = express.Router();
const routeRepo = require('../repositories/routeRepo');

const { logEvent, logError } = require('../lib/logger');

router.get('/', async (req, res) => {
    try {
        const routes = await routeRepo.getAll();
        res.json({ success: true, data: routes });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_ROUTES', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const id = await routeRepo.create(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_ROUTE', 'routes', id, `Route ${req.body.name} created`);
        res.status(201).json({ success: true, data: { id } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_ROUTE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await routeRepo.update(req.params.id, req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_ROUTE', 'routes', req.params.id, `Route ID ${req.params.id} updated to ${req.body.name}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_ROUTE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await routeRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_ROUTE', 'routes', req.params.id, `Route ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_ROUTE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
