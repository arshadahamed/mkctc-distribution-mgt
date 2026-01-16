const express = require('express');
const router = express.Router();
const priceLevelRepo = require('../repositories/priceLevelRepo');
const { checkPermission } = require('../middleware/auth');

router.get('/', checkPermission('settings', 'view'), async (req, res) => {
    try {
        const data = await priceLevelRepo.getAll();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/', checkPermission('settings', 'edit'), async (req, res) => {
    try {
        const id = await priceLevelRepo.create(req.body);
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.put('/:id', checkPermission('settings', 'edit'), async (req, res) => {
    try {
        await priceLevelRepo.update(req.params.id, req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', checkPermission('settings', 'edit'), async (req, res) => {
    try {
        await priceLevelRepo.delete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
