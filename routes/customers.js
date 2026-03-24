const express = require('express');
const router = express.Router();
const customerRepo = require('../repositories/customerRepo');
const { logEvent, logError } = require('../lib/logger');
const { checkPermission } = require('../middleware/auth');

// ─────────────────────────────────────────────
// STATIC ROUTES (must be before /:id wildcards)
// ─────────────────────────────────────────────

// Get all customers
router.get('/', checkPermission('customers', 'view'), async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            route_id: req.query.route_id,
            search: req.query.search,
            page: req.query.page,
            limit: req.query.limit
        };
        const result = await customerRepo.getAll(filters);
        res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
        await logError(0, 'GET_CUSTOMERS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create customer
router.post('/', async (req, res) => {
    try {
        const customerId = await customerRepo.create(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_CUSTOMER', 'customers', customerId, `Customer ${req.body.name} created`);
        res.status(201).json({ success: true, data: { id: customerId } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_CUSTOMER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reconcile ALL customer balances (bulk) — MUST be before /:id routes
router.post('/reconcile-all-balances', checkPermission('admin', 'manage_settings'), async (req, res) => {
    try {
        const result = await customerRepo.reconcileAllBalances();
        const userId = req.user?.id || 0;
        await logEvent(userId, 'RECONCILE_ALL_BALANCES', 'customers', 0, `Bulk balance reconciliation completed. ${result.updated} customers updated.`);
        res.json({ success: true, data: result });
    } catch (error) {
        await logError(req.user?.id || 0, 'RECONCILE_ALL_BALANCES', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─────────────────────────────────────────────
// WILDCARD /:id ROUTES
// ─────────────────────────────────────────────

// Get by ID
router.get('/:id', async (req, res) => {
    try {
        const customer = await customerRepo.getById(req.params.id);
        if (customer) {
            res.json({ success: true, data: customer });
        } else {
            res.status(404).json({ success: false, message: 'Customer not found' });
        }
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_CUSTOMER_BY_ID', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
        await customerRepo.update(req.params.id, req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_CUSTOMER', 'customers', req.params.id, `Customer ID ${req.params.id} updated: ${req.body.name}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_CUSTOMER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete customer
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const permanent = req.query.permanent === 'true';
        if (permanent) {
            await customerRepo.deletePermanent(id);
            const userId = req.user?.id || 0;
            await logEvent(userId, 'DELETE_PERMANENT', 'customers', id, `Customer ID ${id} permanently deleted`);
        } else {
            await customerRepo.delete(id);
            const userId = req.user?.id || 0;
            await logEvent(userId, 'DELETE_CUSTOMER', 'customers', id, `Customer ID ${id} soft-deleted`);
        }
        res.json({ success: true });
    } catch (error) {
        const userId = req.user?.id || 0;
        await logError(userId, 'DELETE_CUSTOMER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restore customer
router.put('/:id/restore', async (req, res) => {
    try {
        await customerRepo.restore(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'RESTORE_CUSTOMER', 'customers', req.params.id, `Customer ID ${req.params.id} restored`);
        res.json({ success: true });
    } catch (error) {
        const userId = req.user?.id || 0;
        await logError(userId, 'RESTORE_CUSTOMER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get customer ledger
router.get('/:id/ledger', async (req, res) => {
    try {
        const customer = await customerRepo.getById(req.params.id);
        const ledger = await customerRepo.getLedger(req.params.id);
        res.json({
            success: true,
            data: { customer, ledger }
        });
    } catch (error) {
        await logError(0, 'GET_CUSTOMER_LEDGER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reconcile balance for a single customer
router.post('/:id/reconcile-balance', checkPermission('customers', 'edit'), async (req, res) => {
    try {
        const id = req.params.id;
        const trueBalance = await customerRepo.reconcileBalance(id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'RECONCILE_BALANCE', 'customers', id, `Balance reconciled to LKR ${trueBalance} for customer ID ${id}`);
        res.json({ success: true, data: { trueBalance } });
    } catch (error) {
        await logError(req.user?.id || 0, 'RECONCILE_BALANCE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
