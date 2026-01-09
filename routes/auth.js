const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getQuery, runQuery } = require('../lib/db');
const { logEvent, logError } = require('../lib/logger');
const { JWT_SECRET, isAuthenticated, isAdmin, encrypt } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);

        if (user) {
            // Verify Password using bcrypt
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                await logEvent(0, 'LOGIN_FAILED', 'users', null, `Failed login attempt (Wrong Password) for username: ${username}`);
                return res.status(401).json({ success: false, message: 'Invalid username or password' });
            }

            if (user.is_blocked) {
                await logEvent(0, 'LOGIN_BLOCKED', 'users', user.id, `Blocked user ${username} attempted to login`);
                return res.status(403).json({ success: false, message: 'Your account has been blocked. Please contact administrator.' });
            }
            // Update login status
            const now = new Date().toISOString();
            await runQuery('UPDATE users SET login_status = ?, last_login = ? WHERE id = ?', ['online', now, user.id]);

            // Log event
            await logEvent(user.id, 'LOGIN', 'users', user.id, `User ${username} logged in successfully`);

            // Sign JWT - Payload will be encrypted in middleware logic if needed, 
            // but for now we follow "Encrypted Method" by ensuring secure signing and hashing.
            // I'll actually encrypt the payload string before signing to satisfy the prompt.
            const rawPayload = {
                id: user.id,
                username: user.username,
                role: user.role,
                token_version: user.token_version || 0
            };

            // Encrypt the payload string
            const encryptedData = encrypt(JSON.stringify(rawPayload));
            const token = jwt.sign({ data: encryptedData }, JWT_SECRET, { expiresIn: '24h' });

            // Don't send password to frontend
            delete user.password;

            // Set Cookie as Session Cookie (clears on browser close)
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.json({
                success: true,
                data: { user, token }
            });
        } else {
            // Log failed attempt
            await logEvent(0, 'LOGIN_FAILED', 'users', null, `Failed login attempt (User Not Found) for username: ${username}`);
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    } catch (error) {
        await logError(0, 'AUTH_LOGIN', error);
        console.error('Login Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout
router.post('/logout', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        if (userId) {
            await logEvent(userId, 'LOGOUT', 'users', userId, `User logged out`);
            await runQuery('UPDATE users SET login_status = ? WHERE id = ?', ['offline', userId]);
        }
        res.clearCookie('token');
        res.json({ success: true });
    } catch (error) {
        await logError(0, 'AUTH_LOGOUT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check auth status
router.get('/me', isAuthenticated, (req, res) => {
    res.json({ success: true, user: req.user });
});

// Get active users (Admin only)
router.get('/active-users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await allQuery('SELECT id, name, username, role, last_login FROM users WHERE login_status = ?', ['online']);
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
