const express = require('express');
const router = express.Router();
const bankingRepo = require('../repositories/bankingRepo');
const { logEvent, logError } = require('../lib/logger');

// Get all cheques
router.get('/cheques', async (req, res) => {
    try {
        const data = await bankingRepo.getAllCheques();
        const stats = await bankingRepo.getChequeStats();
        res.json({ success: true, data, stats });
    } catch (e) {
        await logError(req.user?.id || 0, 'GET_CHEQUES', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update cheque status
router.put('/cheques/:id', async (req, res) => {
    try {
        const { status, remarks } = req.body;
        await bankingRepo.updateChequeStatus(req.params.id, status, remarks);

        await logEvent(req.user?.id || 0, 'UPDATE_CHEQUE', 'cheque_details', req.params.id, `Cheque status updated to ${status}`);

        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'UPDATE_CHEQUE', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
