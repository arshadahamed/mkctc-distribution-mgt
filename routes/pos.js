const express = require('express');
const router = express.Router();
const posRepo = require('../repositories/posRepo');
const { logEvent, logError } = require('../lib/logger');
const { isAuthenticated } = require('../middleware/auth');

// Get active loads for POS
router.get('/active-loads', isAuthenticated, async (req, res) => {
    try {
        const loads = await posRepo.getActiveLoads();
        res.json(loads);
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_POS_ACTIVE_LOADS', error);
        res.status(500).json({ error: error.message });
    }
});

// Get stock for a specific load
router.get('/truck-stock/:loadId', isAuthenticated, async (req, res) => {
    try {
        const stock = await posRepo.getTruckStock(req.params.loadId);
        res.json(stock);
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_POS_TRUCK_STOCK', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
