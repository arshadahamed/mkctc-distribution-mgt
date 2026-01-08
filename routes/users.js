const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepo');
const { logEvent, logError } = require('../lib/logger');
const { isAdmin } = require('../middleware/auth');

// Apply isAdmin to all routes except self-update (handled in PUT)
// For simplicity, we'll check role inside or apply to most.
// Actually, listing users might be needed for dropdowns, but sensitive fields are removed.
// We'll restrict CREATE, DELETE, FORCE-LOGOUT to ADMIN.

// Get all users (Admin only)
router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await userRepo.getAll();
        // Remove password for non-admins
        if (req.user.role !== 'admin') {
            users.forEach(u => delete u.password);
        }
        res.json({ success: true, data: users });
    } catch (error) {
        await logError(req.user?.id, 'GET_USERS', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single user
router.get('/:id', async (req, res) => {
    try {
        const user = await userRepo.getById(req.params.id);
        if (user) {
            // Only admin can see passwords
            if (req.user.role !== 'admin') {
                delete user.password;
            }
            res.json({ success: true, data: user });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        await logError(req.user?.id, 'GET_USER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add user (Admin only)
router.post('/', isAdmin, async (req, res) => {
    try {
        // Validate
        if (!req.body.name || !req.body.username || !req.body.password) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Check if username exists
        const existing = await userRepo.getByUsername(req.body.username);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        const result = await userRepo.create(req.body);
        await logEvent(req.user?.id, 'CREATE', 'users', result.lastID, `Created user ${req.body.username}`);
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        await logError(req.user?.id, 'CREATE_USER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Update user
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const updates = req.body;

        // Security Check: Only self or Admin can update
        if (parseInt(req.user.id) !== parseInt(id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden. You can only update your own profile.' });
        }

        // Security Check: Changing Password
        if (updates.password) {
            const isSelfUpdate = (parseInt(req.user.id) === parseInt(id));

            // If updating OWN password, MUST provide valid current_password
            if (isSelfUpdate) {
                if (!updates.current_password) {
                    return res.status(400).json({ success: false, message: 'Current password is required to change your password.' });
                }
                const currentUser = await userRepo.getById(id);
                const isMatch = await bcrypt.compare(updates.current_password, currentUser.password);
                if (!currentUser || !isMatch) {
                    return res.status(403).json({ success: false, message: 'Current password is incorrect.' });
                }
            }
            // If updating SOMEONE ELSE, must be Admin
            else if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Unauthorized to change another user\'s password.' });
            }
            // Admin resetting someone else's password -> No current_password needed
        }

        // Prevent non-admins from promoting themselves or others
        if (updates.role && req.user.role !== 'admin') {
            delete updates.role;
        }

        await userRepo.update(id, updates);
        await logEvent(req.user?.id, 'UPDATE', 'users', id, `Updated user ${id}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id, 'UPDATE_USER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Force logout (Admin only)
router.post('/:id/force-logout', isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        await userRepo.updateLoginStatus(id, 'offline');
        await userRepo.invalidateTokens(id); // Invalidate JWTs
        await logEvent(req.user?.id, 'FORCE_LOGOUT', 'users', id, `Forced logout for user ${id}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id, 'FORCE_LOGOUT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete user (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        await userRepo.delete(id);
        await logEvent(req.user?.id, 'DELETE', 'users', id, `Deleted user ${id}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id, 'DELETE_USER', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
