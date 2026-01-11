const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { isAuthenticated } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Multer Setup for Image Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// API Routes
app.use('/api/auth', require('./routes/auth')); // Must be before generic auth check

// All routes below this line require authentication
app.use('/api/products', isAuthenticated, require('./routes/products'));
app.use('/api/customers', isAuthenticated, require('./routes/customers'));
app.use('/api/distribution', isAuthenticated, require('./routes/distribution'));
app.use('/api/vehicles', isAuthenticated, require('./routes/vehicles'));
app.use('/api/sales', isAuthenticated, require('./routes/sales'));
app.use('/api/payments', isAuthenticated, require('./routes/payments'));
app.use('/api/expenses', isAuthenticated, require('./routes/expenses'));
app.use('/api/dashboard', isAuthenticated, require('./routes/dashboard'));
app.use('/api/suppliers', isAuthenticated, require('./routes/suppliers'));
app.use('/api/categories', isAuthenticated, require('./routes/categories'));
app.use('/api/brands', isAuthenticated, require('./routes/brands'));
app.use('/api/units', isAuthenticated, require('./routes/units'));
app.use('/api/sizes', isAuthenticated, require('./routes/sizes'));
app.use('/api/master/routes', isAuthenticated, require('./routes/routes'));
app.use('/api/visits', isAuthenticated, require('./routes/visits'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users', isAuthenticated, require('./routes/users'));
app.use('/api/pos', isAuthenticated, require('./routes/pos'));
app.use('/api/banking', isAuthenticated, require('./routes/banking'));
app.use('/api/backup', isAuthenticated, require('./routes/backup'));
app.use('/api/reports', isAuthenticated, require('./routes/reports'));
app.use('/api/rma', isAuthenticated, require('./routes/rma'));

// Image Upload Endpoint (Protected)
app.post('/api/upload', isAuthenticated, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
});

// Start Backup Scheduler
const backupService = require('./services/backupService');


// Explicit Page Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    // Prevent caching to avoid back-button access after logout
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.sendFile(path.join(__dirname, 'private', 'dashboard.html'));
});

// Support SPA clean URLs (e.g. /admin/products)
app.get(['/admin/*', '/employee/*'], isAuthenticated, (req, res) => {
    // Prevent caching to avoid back-button access after logout
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.sendFile(path.join(__dirname, 'private', 'dashboard.html'));
});

// Serve other static files (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// 404 Handler (Global Catch-All)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🚀 Agro Distribution System running on http://localhost:${PORT}`);
        console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
        console.log(`🔌 API: http://localhost:${PORT}/api\n`);

        // Initialize Scheduler
        const backupService = require('./services/backupService');
        backupService.initScheduler();
    });
}

module.exports = app;
