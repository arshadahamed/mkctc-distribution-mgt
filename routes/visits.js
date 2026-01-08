const express = require('express');
const router = express.Router();
const visitRepo = require('../repositories/visitRepo');
const customerRepo = require('../repositories/customerRepo');
const { logEvent, logError } = require('../lib/logger');

router.get('/', async (req, res) => {
    try {
        const visits = await visitRepo.getAll(req.query);
        res.json({ success: true, data: visits });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_VISITS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const customer = await customerRepo.getById(req.body.customer_id);
        if (!customer) throw new Error('Customer not found');
        const userId = req.user?.id || 0;
        const safeUserId = userId > 0 ? userId : 1;
        const visitData = {
            ...req.body,
            route_id: customer.route_id,
            visited_by: safeUserId
        };

        const id = await visitRepo.create(visitData);
        await logEvent(userId, 'LOG_VISIT', 'shop_visits', id, `Visit recorded for ${customer.name}`);

        res.status(201).json({ success: true, data: { id } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_VISIT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const customer = await customerRepo.getById(req.body.customer_id);
        if (!customer) throw new Error('Customer not found');

        const userId = req.user?.id || 0;
        const visitData = {
            ...req.body,
            route_id: customer.route_id
        };

        await visitRepo.update(req.params.id, visitData);
        await logEvent(userId, 'UPDATE_VISIT', 'shop_visits', req.params.id, `Visit updated for ${customer.name}`);

        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_VISIT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await visitRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_VISIT', 'shop_visits', req.params.id, `Visit ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_VISIT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
