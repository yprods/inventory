/**
 * Import Data Center Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs-extra');
const path = require('path');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/imports');
        await fs.ensureDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.csv', '.xlsx', '.xls', '.json'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV, Excel, and JSON files are allowed'));
        }
    }
});

/**
 * Import center main page
 */
router.get('/import', (req, res) => {
    res.render('import/index', {
        title: 'מרכז ייבוא נתונים',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Handle file import
 */
router.post('/import/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.render('import/index', {
                title: 'מרכז ייבוא נתונים',
                error: 'לא נבחר קובץ',
                user: req.user || { name: 'Guest' }
            });
        }
        
        const { itemType, mapping } = req.body;
        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        
        let results = {
            total: 0,
            success: 0,
            failed: 0,
            errors: []
        };
        
        if (fileExt === '.csv') {
            results = await importCSV(filePath, itemType, mapping);
        } else if (fileExt === '.json') {
            results = await importJSON(filePath, itemType, mapping);
        } else {
            return res.render('import/index', {
                title: 'מרכז ייבוא נתונים',
                error: 'פורמט קובץ לא נתמך. אנא השתמש ב-CSV או JSON',
                user: req.user || { name: 'Guest' }
            });
        }
        
        // Clean up uploaded file
        await fs.remove(filePath);
        
        res.render('import/results', {
            title: 'תוצאות ייבוא',
            results: results,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Import error:', error);
        res.render('import/index', {
            title: 'מרכז ייבוא נתונים',
            error: 'שגיאה בייבוא הקובץ: ' + error.message,
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Import CSV file
 */
async function importCSV(filePath, itemType, mapping) {
    return new Promise((resolve, reject) => {
        const results = { total: 0, success: 0, failed: 0, errors: [] };
        const rows = [];
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                rows.push(row);
                results.total++;
            })
            .on('end', async () => {
                try {
                    for (const row of rows) {
                        try {
                            await importRow(row, itemType, mapping);
                            results.success++;
                        } catch (error) {
                            results.failed++;
                            results.errors.push({
                                row: results.total - rows.length + rows.indexOf(row) + 1,
                                error: error.message,
                                data: row
                            });
                        }
                    }
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', reject);
    });
}

/**
 * Import JSON file
 */
async function importJSON(filePath, itemType, mapping) {
    const results = { total: 0, success: 0, failed: 0, errors: [] };
    const data = await fs.readJson(filePath);
    const rows = Array.isArray(data) ? data : [data];
    
    results.total = rows.length;
    
    for (const row of rows) {
        try {
            await importRow(row, itemType, mapping);
            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push({
                row: rows.indexOf(row) + 1,
                error: error.message,
                data: row
            });
        }
    }
    
    return results;
}

/**
 * Import single row
 */
async function importRow(row, itemType, mapping) {
    const mappingObj = mapping ? JSON.parse(mapping) : {};
    
    // Default mapping if not provided
    const nameField = mappingObj.name || 'name' || 'Name' || Object.keys(row)[0];
    const name = row[nameField];
    
    if (!name || !name.trim()) {
        throw new Error('Name field is required');
    }
    
    // Insert into CI
    await executeQuery(`
        INSERT INTO CI (Name, CI_ID, CreatedAt)
        VALUES (@name, @ciId, GETDATE())
    `, { name: name.trim(), ciId: name.trim() });
    
    // Build field values
    const fieldValues = { name: name.trim() };
    for (let i = 0; i <= 50; i++) {
        const fieldKey = mappingObj[`f${i}`] || Object.keys(row)[i] || null;
        fieldValues[`f${i}`] = fieldKey && row[fieldKey] ? row[fieldKey] : null;
    }
    fieldValues.f6 = itemType || 'Imported';
    
    // Insert into DATABOX
    const fieldNames = Object.keys(fieldValues).filter(k => k !== 'name');
    const fieldParams = fieldNames.map(f => `@${f}`).join(', ');
    const fieldValuesList = fieldNames.map(f => fieldValues[f]);
    
    const insertQuery = `
        INSERT INTO DATABOX (name, ${fieldNames.join(', ')})
        VALUES (@name, ${fieldParams})
    `;
    
    const params = { name: name.trim(), ...fieldValues };
    await executeQuery(insertQuery, params);
}

/**
 * Get import template
 */
router.get('/import/template', (req, res) => {
    const { type } = req.query;
    
    let template = {};
    switch (type) {
        case 'Computer':
            template = {
                name: 'Computer-001',
                model: 'Dell Optiplex',
                os: 'Windows 10',
                cpu: 'Intel i5',
                ram: '8GB',
                hdd: '500GB',
                ip: '192.168.1.100',
                location: 'Office 1',
                status: 'Active'
            };
            break;
        case 'Printer':
            template = {
                name: 'Printer-001',
                model: 'HP LaserJet',
                ip: '192.168.1.101',
                location: 'Office 1',
                status: 'Active'
            };
            break;
        case 'Contact':
            template = {
                name: 'John Doe',
                phone: '02-1234567',
                mobile: '050-1234567',
                email: 'john@example.com',
                department: 'IT',
                position: 'Manager'
            };
            break;
        default:
            template = {
                name: 'Item-001',
                field1: 'Value 1',
                field2: 'Value 2'
            };
    }
    
    res.json({ success: true, template });
});

/**
 * Export data
 */
router.get('/import/export', async (req, res) => {
    try {
        const { itemType, format } = req.query;
        
        let query = `
            SELECT CI.*, DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE 1=1
        `;
        
        if (itemType) {
            query += ` AND DATABOX.f6 = @itemType`;
        }
        
        const results = await executeQuery(query, itemType ? { itemType } : {});
        
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=export-${Date.now()}.json`);
            res.json(results);
        } else if (format === 'csv') {
            // Convert to CSV
            if (results.length === 0) {
                return res.status(400).json({ success: false, error: 'No data to export' });
            }
            
            const headers = Object.keys(results[0]);
            const csv = [
                headers.map(h => `"${h}"`).join(','),
                ...results.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=export-${Date.now()}.csv`);
            res.send(csv);
        } else {
            res.json({ success: true, data: results });
        }
    } catch (error) {
        logger.error('Export error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Export to SQLite
 */
router.post('/import/export-sqlite', async (req, res) => {
    try {
        const sqliteService = require('../services/sqliteExportService');
        const result = await sqliteService.exportToSQLite();
        res.json({ success: true, message: 'Data exported to SQLite', count: result.count });
    } catch (error) {
        logger.error('Export to SQLite error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Download SQLite database
 */
router.get('/import/download-sqlite', (req, res) => {
    try {
        const sqliteService = require('../services/sqliteExportService');
        const dbPath = sqliteService.getSQLitePath();
        
        if (fs.pathExistsSync(dbPath)) {
            res.download(dbPath, 'sefer-maarexet-local.db');
        } else {
            res.status(404).json({ success: false, error: 'SQLite database not found' });
        }
    } catch (error) {
        logger.error('Download SQLite error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Enable local mode
 */
router.post('/import/enable-local-mode', async (req, res) => {
    try {
        const sqliteService = require('../services/sqliteExportService');
        await sqliteService.enableLocalMode();
        res.json({ success: true, message: 'Local mode enabled' });
    } catch (error) {
        logger.error('Enable local mode error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Sync to SQLite
 */
router.post('/import/sync-sqlite', async (req, res) => {
    try {
        const sqliteService = require('../services/sqliteExportService');
        const result = await sqliteService.syncToSQLite();
        res.json({ success: true, count: result.count, message: 'Data synced to SQLite' });
    } catch (error) {
        logger.error('Sync to SQLite error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

