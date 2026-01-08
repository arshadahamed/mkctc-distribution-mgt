const express = require('express');
const router = express.Router();
const supplierRepo = require('../repositories/supplierRepo');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { logEvent, logError } = require('../lib/logger');

// Configure multer for excel imports
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const importDir = path.join(__dirname, '../temp/imports');
        if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
        cb(null, importDir);
    },
    filename: (req, file, cb) => {
        cb(null, `supplier-import-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });


router.get('/', async (req, res) => {
    try {
        const filters = {
            search: req.query.search,
            page: req.query.page,
            limit: req.query.limit
        };
        const result = await supplierRepo.getAll(filters);
        res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) {
        await logError(req.user?.id || 0, 'GET_SUPPLIERS', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Export suppliers to Excel
router.get('/export/excel', isAdmin, async (req, res) => {
    try {
        // Get all suppliers for export (high limit)
        const result = await supplierRepo.getAll({ limit: 9999 });
        const suppliers = result.data;

        const data = suppliers.map(s => ({
            'Name': s.name,
            'Category': s.category || '',
            'Address': s.address || '',
            'Contact': s.contact || '',
            'TSR Name': s.tsr_name || '',
            'Area Manager': s.area_manager_name || '',
            'Tags': s.tags || '',
            'Created At': s.created_at
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Suppliers');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=suppliers_export.xlsx');
        await logEvent(req.user?.id || 0, 'EXPORT_SUPPLIERS_EXCEL', 'suppliers', 0, 'Suppliers list exported to Excel');
        res.send(buffer);
    } catch (error) {
        await logError(req.user?.id || 0, 'EXPORT_SUPPLIERS_EXCEL', error);
        console.error('Export Suppliers Excel Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/', isAdmin, async (req, res) => {
    try {
        const id = await supplierRepo.create(req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CREATE_SUPPLIER', 'suppliers', id, `Supplier ${req.body.name} created`);
        res.json({ success: true, data: { id } });
    } catch (e) {
        await logError(req.user?.id || 0, 'CREATE_SUPPLIER', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Import suppliers from Excel
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

        let importedCount = 0;
        let errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const supplierData = {
                    name: row['Name'] || row['name'] || row['Supplier Name'],
                    address: row['Address'] || row['address'] || '',
                    contact: row['Contact'] || row['contact'] || row['Phone'] || '',
                    category: row['Category'] || row['category'] || '',
                    tags: row['Tags'] || row['tags'] || '',
                    tsr_name: row['TSR Name'] || row['tsr_name'] || row['TSR'] || '',
                    area_manager_name: row['Area Manager'] || row['area_manager_name'] || row['AM'] || ''
                };

                if (!supplierData.name) {
                    errors.push(`Row ${i + 2}: Missing supplier name`);
                    continue;
                }

                await supplierRepo.create(supplierData);
                importedCount++;
            } catch (err) {
                errors.push(`Row ${i + 2}: ${err.message}`);
            }
        }

        // Cleanup
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        const userId = req.user?.id || 0;
        await logEvent(userId, 'IMPORT_SUPPLIERS', 'suppliers', 0, `Imported ${importedCount} suppliers, ${errors.length} errors`);

        res.json({
            success: true,
            message: `Imported ${importedCount} suppliers successfully.`,
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        await logError(req.user?.id || 0, 'IMPORT_SUPPLIERS', error);
        console.error('Import Suppliers Excel Error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/:id', isAdmin, async (req, res) => {
    try {
        await supplierRepo.update(req.params.id, req.body);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'UPDATE_SUPPLIER', 'suppliers', req.params.id, `Supplier ID ${req.params.id} updated: ${req.body.name}`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'UPDATE_SUPPLIER', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        await supplierRepo.delete(req.params.id);
        const userId = req.user?.id || 0;
        await logEvent(userId, 'DELETE_SUPPLIER', 'suppliers', req.params.id, `Supplier ID ${req.params.id} deleted`);
        res.json({ success: true });
    } catch (e) {
        await logError(req.user?.id || 0, 'DELETE_SUPPLIER', e);
        if (e.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(409).json({
                success: false,
                error: 'Cannot delete supplier because it has products linked to it. Please delete the products first or reassign them to another supplier.'
            });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
