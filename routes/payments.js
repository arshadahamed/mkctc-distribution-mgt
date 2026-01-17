const express = require('express');
const router = express.Router();
const paymentRepo = require('../repositories/paymentRepo');
const { isAdmin } = require('../middleware/auth');

const { logEvent, logError } = require('../lib/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for payment uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './public/uploads/payments';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cheque-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Get all receipts
router.get('/', async (req, res) => {
    try {
        const filters = {
            customer_id: req.query.customer_id,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            search: req.query.search,
            payment_method: req.query.payment_method,
            receipt_category: req.query.receipt_category
        };
        const receipts = await paymentRepo.getAll(filters);
        res.json({ success: true, data: receipts });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_PAYMENTS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get outstanding invoices for a customer
router.get('/outstanding/:customerId', async (req, res) => {
    try {
        const invoices = await paymentRepo.getOutstandingInvoices(req.params.customerId);
        res.json({ success: true, data: invoices });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_OUTSTANDING_INVOICES', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get by ID
router.get('/:id', async (req, res) => {
    try {
        const receipt = await paymentRepo.getById(req.params.id);
        if (receipt) {
            res.json({ success: true, data: receipt });
        } else {
            res.status(404).json({ success: false, message: 'Receipt not found' });
        }
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_PAYMENT_BY_ID', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create receipt
router.post('/', upload.single('cheque_image'), async (req, res) => {
    try {
        let paymentData = req.body;

        // If data comes as FormData, we need to parse JSON fields if they were stringified
        if (typeof paymentData.cheque === 'string') {
            paymentData.cheque = JSON.parse(paymentData.cheque);
        }
        if (typeof paymentData.allocations === 'string') {
            paymentData.allocations = JSON.parse(paymentData.allocations);
        }

        if (req.file) {
            if (!paymentData.cheque) paymentData.cheque = {};
            paymentData.cheque.image = `/uploads/payments/${req.file.filename}`;
        }

        const receiptId = await paymentRepo.createReceipt(paymentData);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_RECEIPT', 'receipts', receiptId, `Receipt created for ${paymentData.amount} amount`);
        res.status(201).json({ success: true, data: { id: receiptId } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_RECEIPT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get payment summary (Admin only)
router.get('/summary/stats', isAdmin, async (req, res) => {
    try {
        const stats = await paymentRepo.getPaymentSummary(req.query);
        res.json({ success: true, data: stats });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_PAYMENT_STATS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete receipt (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        await paymentRepo.deleteReceipt(id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_RECEIPT', 'receipts', id, `Receipt ID ${id} deleted`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_RECEIPT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update receipt
router.put('/:id', upload.single('cheque_image'), async (req, res) => {
    try {
        const id = req.params.id;
        let paymentData = req.body;

        if (typeof paymentData.cheque === 'string') {
            paymentData.cheque = JSON.parse(paymentData.cheque);
        }

        if (req.file) {
            if (!paymentData.cheque) paymentData.cheque = {};
            paymentData.cheque.image = `/uploads/payments/${req.file.filename}`;
        }

        await paymentRepo.updateReceipt(id, paymentData);
        const userId = req.user?.id || 0;
        const msg = `Receipt ID ${id} details updated. Date: ${paymentData.receipt_date}, Receiver: ${paymentData.receiver_name}${paymentData.amount ? ', Amount: ' + paymentData.amount : ''}`;
        await logEvent(userId, 'UPDATE_RECEIPT', 'receipts', id, msg);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_RECEIPT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
