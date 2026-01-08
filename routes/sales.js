const express = require('express');
const router = express.Router();
const salesRepo = require('../repositories/salesRepo');
const { isAdmin } = require('../middleware/auth');

const { logEvent, logError } = require('../lib/logger');

// Get all invoices
router.get('/', async (req, res) => {
    try {
        const filters = {
            customer_id: req.query.customer_id,
            date_from: req.query.date_from,
            date_to: req.query.date_to
        };
        const invoices = await salesRepo.getAll(filters);
        res.json({ success: true, data: invoices });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_SALES', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get next invoice number
router.get('/next-number', async (req, res) => {
    try {
        const nextNumber = await salesRepo.generateInvoiceNumber();
        res.json({ success: true, data: { nextNumber } });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_NEXT_INVOICE_NUMBER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get by ID
router.get('/:id', async (req, res) => {
    try {
        const invoice = await salesRepo.getById(req.params.id);
        if (invoice) {
            res.json({ success: true, data: invoice });
        } else {
            res.status(404).json({ success: false, message: 'Invoice not found' });
        }
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_SALE_BY_ID', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create invoice
router.post('/', async (req, res) => {
    try {
        const invoiceId = await salesRepo.createInvoice(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_INVOICE', 'invoices', invoiceId, `Invoice ${req.body.invoice_number} created for ${req.body.net_total} total`);
        res.status(201).json({ success: true, data: { id: invoiceId } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_INVOICE', error);
        console.error('Create Invoice Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update status
router.put('/:id/status', async (req, res) => {
    try {
        await salesRepo.updateStatus(req.params.id, req.body.status);
        await logEvent(req.user?.id || 0, 'UPDATE_INVOICE_STATUS', 'invoices', req.params.id, `Invoice status updated to ${req.body.status}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_INVOICE_STATUS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Full Update (for Recall)
router.put('/:id', async (req, res) => {
    try {
        await salesRepo.updateInvoice(req.params.id, req.body);
        await logEvent(req.user?.id || 0, 'UPDATE_INVOICE', 'invoices', req.params.id, `Invoice details updated`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_INVOICE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get sales summary (Admin only)
router.get('/summary/stats', isAdmin, async (req, res) => {
    try {
        const stats = await salesRepo.getSalesSummary(req.query);
        res.json({ success: true, data: stats });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_SALES_STATS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get next invoice number


// Delete Invoice (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        await salesRepo.deleteInvoice(req.params.id);
        await logEvent(req.user?.id || 0, 'DELETE_INVOICE', 'invoices', req.params.id, 'Invoice deleted');
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_INVOICE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Pre-Order Routes
router.get('/pre-orders/list', async (req, res) => {
    try {
        const orders = await salesRepo.getAllPreOrders(req.query);
        res.json({ success: true, data: orders });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_PRE_ORDERS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/pre-orders/:id', async (req, res) => {
    try {
        const order = await salesRepo.getPreOrderById(req.params.id);
        if (order) res.json({ success: true, data: order });
        else res.status(404).json({ success: false, message: 'Pre-order not found' });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_PRE_ORDER_BY_ID', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/pre-orders', async (req, res) => {
    try {
        const orderData = req.body;
        orderData.created_by = req.user?.id || 0;
        const orderId = await salesRepo.createPreOrder(orderData);
        await logEvent(orderData.created_by, 'CREATE_PRE_ORDER', 'pre_orders', orderId, `Pre-order created`);
        res.status(201).json({ success: true, data: { id: orderId } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_PRE_ORDER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/pre-orders/:id/status', async (req, res) => {
    try {
        await salesRepo.updatePreOrderStatus(req.params.id, req.body.status);
        await logEvent(req.user?.id || 0, 'UPDATE_PRE_ORDER_STATUS', 'pre_orders', req.params.id, `Status updated to ${req.body.status}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_PRE_ORDER_STATUS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete Pre-order (Admin only)
router.delete('/pre-orders/:id', isAdmin, async (req, res) => {
    try {
        await salesRepo.deletePreOrder(req.params.id);
        await logEvent(req.user?.id || 0, 'DELETE_PRE_ORDER', 'pre_orders', req.params.id, 'Pre-order deleted');
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_PRE_ORDER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/customer-discounts/:customerId', async (req, res) => {
    try {
        const discounts = await salesRepo.getCustomerProductDiscounts(req.params.customerId);
        res.json({ success: true, data: discounts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
