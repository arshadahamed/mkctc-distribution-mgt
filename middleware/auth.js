const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getQuery } = require('../lib/db');

// In a real app, this would be in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'agro-distribution-jwt-secret-2024-secure';
// Derive a 32-byte key for AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(JWT_SECRET)).digest();
const IV_LENGTH = 16;

// Encryption helpers
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

const isAuthenticated = async (req, res, next) => {
    try {
        let token = null;

        // Check Authorization Header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        // Fallback to Cookies (for page routes)
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            if (req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
            }
            return res.redirect('/login');
        }

        // 1. Verify JWS (Signature)
        const jwtPayload = jwt.verify(token, JWT_SECRET);

        // 2. Decrypt Content (Encrypted Data)
        let payload;
        try {
            const decryptedString = decrypt(jwtPayload.data);
            payload = JSON.parse(decryptedString);
        } catch (e) {
            throw new Error('Could not decrypt token payload');
        }

        // Verify user still exists and is not blocked
        const user = await getQuery('SELECT * FROM users WHERE id = ?', [payload.id]);

        if (!user || user.is_blocked) {
            return res.status(401).json({ success: false, message: 'User not found or blocked.' });
        }

        // Check token version (Force Logout Support)
        if (payload.token_version !== undefined && user.token_version !== payload.token_version) {
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }

        // Remove password before attaching to request
        delete user.password;
        req.user = user;
        next();
    } catch (err) {
        console.error('Auth Error:', err);
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
        }
        res.redirect('/login');
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
};

module.exports = { isAuthenticated, isAdmin, JWT_SECRET, encrypt, decrypt };
