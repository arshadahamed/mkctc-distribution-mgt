const express = require('express');
const router = express.Router();
const vehicleRepo = require('../repositories/vehicleRepo');
const { logEvent, logError } = require('../lib/logger');
const { checkPermission } = require('../middleware/auth');

router.get('/', checkPermission('vehicles', 'view'), async (req, res) => {
    try {
        const vehicles = await vehicleRepo.getAll();
        res.json({ success: true, data: vehicles });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_VEHICLES', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:id', checkPermission('vehicles', 'view'), async (req, res) => {
    try {
        const vehicle = await vehicleRepo.getById(req.params.id);
        if (vehicle) {
            res.json({ success: true, data: vehicle });
        } else {
            res.status(404).json({ success: false, message: 'Vehicle not found' });
        }
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_VEHICLE_BY_ID', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/', checkPermission('vehicles', 'create'), async (req, res) => {
    try {
        const id = await vehicleRepo.create(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_VEHICLE', 'trucks', id, `Vehicle ${req.body.registration_number} created`);
        res.status(201).json({ success: true, data: { id } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_VEHICLE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:id', checkPermission('vehicles', 'edit'), async (req, res) => {
    try {
        await vehicleRepo.update(req.params.id, req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_VEHICLE', 'trucks', req.params.id, `Vehicle ${req.body.registration_number} updated`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_VEHICLE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/:id', checkPermission('vehicles', 'delete'), async (req, res) => {
    try {
        await vehicleRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_VEHICLE', 'trucks', req.params.id, `Vehicle ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_VEHICLE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
