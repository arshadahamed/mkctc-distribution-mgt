const express = require('express');
const router = express.Router();
const distributionRepo = require('../repositories/distributionRepo');

const { logEvent, logError } = require('../lib/logger');

// Get active truck loads
router.get('/active-loads', async (req, res) => {
    try {
        const filters = {
            search: req.query.search,
            fromDate: req.query.fromDate,
            toDate: req.query.toDate
        };
        const loads = await distributionRepo.getActiveLoads(filters);
        res.json({ success: true, data: loads });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_ACTIVE_LOADS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get load details
router.get('/loads/:id', async (req, res) => {
    try {
        const load = await distributionRepo.getLoadById(req.params.id);
        if (load) {
            res.json({ success: true, data: load });
        } else {
            res.status(404).json({ success: false, message: 'Load not found' });
        }
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_LOAD_DETAILS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create truck load
router.post('/loads', async (req, res) => {
    try {
        const loadId = await distributionRepo.createLoad(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_TRUCK_LOAD', 'truck_loads', loadId, `Truck load created for Truck ID ${req.body.truck_id}`);
        res.status(201).json({ success: true, data: { id: loadId } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_TRUCK_LOAD', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update truck load
router.put('/loads/:id', async (req, res) => {
    try {
        await distributionRepo.updateLoad(req.params.id, req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_TRUCK_LOAD', 'truck_loads', req.params.id, `Truck load updated`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_TRUCK_LOAD', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create truck unload (reconciliation)
router.post('/unloads', async (req, res) => {
    try {
        const unloadId = await distributionRepo.createUnload(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_TRUCK_UNLOAD', 'truck_unloads', unloadId, `Truck unload created for Load ID ${req.body.load_id}`);
        res.status(201).json({ success: true, data: { id: unloadId } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_TRUCK_UNLOAD', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all truck loads (History)
router.get('/loads', async (req, res) => {
    try {
        const filters = {
            search: req.query.search,
            fromDate: req.query.fromDate,
            toDate: req.query.toDate,
            status: req.query.status
        };
        const loads = await distributionRepo.getAllLoads(filters);
        res.json({ success: true, data: loads });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_ALL_LOADS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete truck load
router.delete('/loads/:id', async (req, res) => {
    try {
        await distributionRepo.deleteLoad(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_TRUCK_LOAD', 'truck_loads', req.params.id, `Truck load deleted`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_TRUCK_LOAD', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get variance report for a load
router.get('/variance/:loadId', async (req, res) => {
    try {
        const report = await distributionRepo.getVarianceReport(req.params.loadId);
        res.json({ success: true, data: report });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_VARIANCE_REPORT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
