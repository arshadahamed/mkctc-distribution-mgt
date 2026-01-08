const express = require('express');
const router = express.Router();
const expenseRepo = require('../repositories/expenseRepo');
const { logEvent, logError } = require('../lib/logger');

// Get all expenses
router.get('/', async (req, res) => {
    try {
        const filters = {
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            category: req.query.category
        };
        const expenses = await expenseRepo.getAll(filters);
        res.json({ success: true, data: expenses });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_EXPENSES', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create expense
router.post('/', async (req, res) => {
    try {
        const expenseData = req.body;
        // Auto-assign created_by from session if not provided (though safely handle if missing)
        expenseData.created_by = req.user?.name || 'System';

        const id = await expenseRepo.create(expenseData);
        await logEvent(req.user?.id || 0, 'CREATE_EXPENSE', 'expenses', id, `Expense created: ${expenseData.category} - ${expenseData.amount}`);
        res.status(201).json({ success: true, data: { id } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_EXPENSE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update expense
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const expenseData = req.body;
        await expenseRepo.update(id, expenseData);
        await logEvent(req.user?.id || 0, 'UPDATE_EXPENSE', 'expenses', id, `Expense updated: ${expenseData.category} - ${expenseData.amount}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_EXPENSE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete expense
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await expenseRepo.delete(id);
        await logEvent(req.user?.id || 0, 'DELETE_EXPENSE', 'expenses', id, `Expense deleted`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_EXPENSE', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
