const express = require('express');
const router = express.Router();
const rmaRepo = require('../repositories/rmaRepo');
const { logEvent, logError } = require('../lib/logger');
const { checkPermission } = require('../middleware/auth');

// List all RMAs
router.get('/', checkPermission('rma', 'view'), async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            customer_id: req.query.customer_id,
            search: req.query.search
        };
        const data = await rmaRepo.getAll(filters);
        res.json({ success: true, data });
    } catch (error) {
        logError(0, 'GET_RMA_LIST', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate next RMA ticket number
router.get('/next-number', checkPermission('rma', 'create'), async (req, res) => {
    try {
        const number = await rmaRepo.generateTicketNumber();
        res.json({ success: true, data: number });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get damaged stock ledger
router.get('/ledger/damaged', checkPermission('rma', 'view'), async (req, res) => {
    try {
        const data = await rmaRepo.getDamagedStock();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single RMA by ID
router.get('/:id', checkPermission('rma', 'view'), async (req, res) => {
    try {
        const data = await rmaRepo.getById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new RMA
router.post('/', checkPermission('rma', 'create'), async (req, res) => {
    try {
        const data = { ...req.body, handled_by: req.user?.id || 1 };
        const id = await rmaRepo.create(data);
        await logEvent(req.user?.id || 1, 'CREATE_RMA', 'rma_requests', id, `RMA ${data.rma_number} created`);
        res.json({ success: true, data: { id } });
    } catch (error) {
        logError(req.user?.id || 1, 'CREATE_RMA_FAILED', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update RMA status and process stock actions
router.put('/:id/status', checkPermission('rma', 'process'), async (req, res) => {
    try {
        const { status, action_taken } = req.body;
        await rmaRepo.updateStatus(req.params.id, status, action_taken, req.user?.id || 1);
        await logEvent(req.user?.id || 1, 'UPDATE_RMA_STATUS', 'rma_requests', req.params.id, `Status updated to ${status}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete RMA
router.delete('/:id', checkPermission('rma', 'delete'), async (req, res) => {
    try {
        await rmaRepo.delete(req.params.id);
        await logEvent(req.user?.id || 1, 'DELETE_RMA', 'rma_requests', req.params.id, 'RMA deleted');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
