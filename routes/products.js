const express = require('express');
const router = express.Router();
const productRepo = require('../repositories/productRepo');
const categoryRepo = require('../repositories/categoryRepo');
const brandRepo = require('../repositories/brandRepo');
const supplierRepo = require('../repositories/supplierRepo');
const unitRepo = require('../repositories/unitRepo');
const { logEvent, logError } = require('../lib/logger');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Configure multer for excel imports
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const importDir = path.join(__dirname, '../temp/imports');
        if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
        cb(null, importDir);
    },
    filename: (req, file, cb) => {
        cb(null, `import-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Get all products with filters
router.get('/', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            search: req.query.search,
            page: req.query.page,
            limit: req.query.limit
        };
        const result = await productRepo.getAll(filters);
        res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_PRODUCTS', error);
        console.error('GET Products Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await productRepo.getById(req.params.id);
        if (product) {
            res.json({ success: true, data: product });
        } else {
            res.status(404).json({ success: false, message: 'Product not found' });
        }
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_PRODUCT_BY_ID', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create product
router.post('/', isAdmin, async (req, res) => {
    try {
        let data = req.body;
        if (typeof data.prices === 'string') data.prices = JSON.parse(data.prices);

        const productId = await productRepo.create(data);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_PRODUCT', 'products', productId, `Product ${data.name} created`);
        res.status(201).json({ success: true, data: { id: productId } });
    } catch (error) {
        await logError(req.user?.id || 0, 'CREATE_PRODUCT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update product
router.put('/:id', isAdmin, async (req, res) => {
    try {
        let data = req.body;
        if (typeof data.prices === 'string') data.prices = JSON.parse(data.prices);

        await productRepo.update(req.params.id, data);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_PRODUCT', 'products', req.params.id, `Product ID ${req.params.id} updated: ${data.name}`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'UPDATE_PRODUCT', error);
        console.error('Update Product Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete product
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        await productRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_PRODUCT', 'products', req.params.id, `Product ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (error) {
        await logError(req.user?.id || 0, 'DELETE_PRODUCT', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export products to Excel
router.get('/export/excel', isAdmin, async (req, res) => {
    try {
        // Get all products for export (high limit)
        const result = await productRepo.getAll({ limit: 9999 });
        const products = result.data;

        // Prepare data for Excel
        const data = products.map(p => ({
            'Reference Code': p.reference_code,
            'Name': p.name,
            'Chemical Name': p.chemical_name,
            'Barcode': p.barcode,
            'Category': p.category_name,
            'Brand': p.brand_name,
            'Supplier': p.supplier_name,
            'Size': p.size,
            'Unit': p.unit,
            'Units Per Carton': p.units_per_carton,
            'Initial Stock': p.initial_stock,
            'Cost (LKR)': p.cost,
            'MSRP (LKR)': p.msrp,
            'Supplier Discount (%)': p.supplier_discount,
            'Tags': p.tags,
            'Status': p.status,
            'Description': p.description
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Products');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products_export.xlsx');
        await logEvent(req.user?.id || 0, 'EXPORT_PRODUCTS_EXCEL', 'products', 0, 'Products list exported to Excel');
        res.send(buffer);
    } catch (error) {
        await logError(req.user?.id || 0, 'EXPORT_PRODUCTS_EXCEL', error);
        console.error('Export Excel Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Import products from Excel
router.post('/import', isAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Excel file is empty' });
        }

        // Fetch lookups
        const [categories, brands, suppliers] = await Promise.all([
            categoryRepo.getAll(),
            brandRepo.getAll(),
            supplierRepo.getAll()
        ]);

        const findId = (list, name) => {
            if (!name) return null;
            const item = list.find(l => l.name.toLowerCase() === name.toString().toLowerCase());
            return item ? item.id : null;
        };

        let importedCount = 0;
        let errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                // Map columns (handling different possible variants of column names)
                const productData = {
                    name: row['Name'] || row['name'] || row['Product Name'],
                    description: row['Description'] || row['description'] || '',
                    chemical_name: row['Chemical Name'] || row['chemical_name'] || '',
                    reference_code: row['Reference Code'] || row['reference_code'] || row['SKU'] || '',
                    barcode: row['Barcode'] || row['barcode'] || '',
                    department_id: null, // Default
                    category_id: findId(categories, row['Category'] || row['category_name']),
                    brand_id: findId(brands, row['Brand'] || row['brand_name']),
                    supplier_id: findId(suppliers, row['Supplier'] || row['supplier_name']),
                    unit: row['Unit'] || row['unit'] || 'pcs',
                    size: row['Size'] || row['size_name'] || '',
                    units_per_carton: parseInt(row['Units Per Carton'] || row['units_per_carton'] || 1),
                    initial_stock: parseFloat(row['Initial Stock'] || row['initial_stock'] || 0),
                    cost: parseFloat(row['Cost'] || row['Cost (LKR)'] || row['cost'] || 0),
                    msrp: parseFloat(row['MSRP'] || row['MSRP (LKR)'] || row['msrp'] || 0),
                    supplier_discount: parseFloat(row['Supplier Discount'] || row['Supplier Discount (%)'] || 0),
                    weighted: [1, '1', 'true', 'yes', 'y'].includes((row['Weighted'] || row['weighted'] || '').toString().toLowerCase()),
                    product_image: row['Image'] || row['Image URL'] || row['product_image'] || null,
                    tags: row['Tags'] || row['tags'] || '',
                    status: (row['Status'] || row['status'] || 'active').toLowerCase() === 'active' ? 'active' : 'inactive'
                };

                if (!productData.name) {
                    errors.push(`Row ${i + 2}: Missing product name`);
                    continue;
                }

                await productRepo.create(productData);
                importedCount++;
            } catch (err) {
                errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        // Cleanup
        fs.unlinkSync(req.file.path);

        await logEvent(0, 'IMPORT_PRODUCTS', 'products', 0, `Imported ${importedCount} products, ${errors.length} errors`);

        res.json({
            success: true,
            message: `Imported ${importedCount} products successfully.`,
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        console.error('Import Excel Error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
