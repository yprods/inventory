/**
 * Printers Routes
 */

const express = require('express');
const router = express.Router();
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Printers list page
 */
router.get('/printers', async (req, res) => {
    try {
        const { search, status, location } = req.query;
        
        let query = `
            SELECT TOP 100 
                CI.Name, CI.CI_ID, CI.CreatedAt,
                DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE CI.Name LIKE @search OR DATABOX.f0 LIKE @search
        `;
        
        const params = { search: `%${search || ''}%` };
        
        // Add filters
        if (status) {
            query += ` AND DATABOX.f1 = @status`;
            params.status = status;
        }
        if (location) {
            query += ` AND DATABOX.f2 LIKE @location`;
            params.location = `%${location}%`;
        }
        
        query += ` ORDER BY CI.CreatedAt DESC`;
        
        const printers = await executeQuery(query, params);
        
        res.render('printers/index', {
            title: 'מדפסות',
            printers: printers || [],
            search: search || '',
            status: status || '',
            location: location || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Printers page error:', error);
        res.render('printers/index', {
            title: 'מדפסות',
            printers: [],
            error: 'שגיאה בטעינת המדפסות',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Printer details page
 */
router.get('/printers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT CI.*, DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE CI.CI_ID = @id OR CI.Name = @id
        `;
        
        const results = await executeQuery(query, { id });
        const printer = results[0] || null;
        
        if (!printer) {
            return res.status(404).render('error', {
                title: '404',
                message: 'מדפסת לא נמצאה'
            });
        }
        
        // Get attachments
        let attachments = [];
        try {
            attachments = await executeSqliteQuery(`
                SELECT * FROM FileAttachments WHERE ItemName = ?
            `, [printer.Name || printer.name]);
        } catch (err) {
            logger.warn('Could not load attachments:', err.message);
        }
        
        // Get connections
        let connections = [];
        try {
            const connectionService = require('../services/connectionMapService');
            connections = await connectionService.getItemConnections(printer.Name || printer.name);
        } catch (err) {
            logger.warn('Could not load connections:', err.message);
        }
        
        res.render('printers/details', {
            title: `מדפסת - ${printer.Name || printer.name}`,
            printer: printer,
            attachments: attachments,
            connections: connections,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Printer details error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת פרטי המדפסת'
        });
    }
});

/**
 * Create printer page
 */
router.get('/printers/create', (req, res) => {
    res.render('printers/create', {
        title: 'יצירת מדפסת חדשה',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Create printer
 */
router.post('/printers/create', async (req, res) => {
    try {
        const { name, model, ip, location, status, description } = req.body;
        
        if (!name || !name.trim()) {
            return res.render('printers/create', {
                title: 'יצירת מדפסת חדשה',
                error: 'שם המדפסת חובה',
                user: req.user || { name: 'Guest' }
            });
        }
        
        // Insert into CI
        await executeQuery(`
            INSERT INTO CI (Name, CI_ID, CreatedAt)
            VALUES (@name, @ciId, GETDATE())
        `, { name: name.trim(), ciId: name.trim() });
        
        // Insert into DATABOX with printer-specific fields
        const fieldValues = {
            name: name.trim(),
            f0: name.trim(), // Name
            f1: status || 'Active', // Status
            f2: location || '', // Location
            f3: model || '', // Model
            f4: ip || '', // IP Address
            f5: description || '', // Description
            f6: 'Printer', // Type
            f7: new Date().toISOString(), // Created Date
            f8: req.user ? req.user.name : 'System' // Created By
        };
        
        const insertQuery = `
            INSERT INTO DATABOX (name, f0, f1, f2, f3, f4, f5, f6, f7, f8)
            VALUES (@name, @f0, @f1, @f2, @f3, @f4, @f5, @f6, @f7, @f8)
        `;
        
        await executeQuery(insertQuery, fieldValues);
        
        // Create network item
        try {
            const networkItemService = require('../services/networkItemService');
            const userName = req.user ? req.user.name : 'System';
            await networkItemService.createNetworkItem(name.trim(), 'Printer', userName, fieldValues);
        } catch (err) {
            logger.warn('NetworkItemService failed:', err.message);
        }
        
        req.session.successMessage = `המדפסת '${name}' נוצרה בהצלחה!`;
        res.redirect(`/printers/${encodeURIComponent(name.trim())}`);
    } catch (error) {
        logger.error('Create printer error:', error);
        res.render('printers/create', {
            title: 'יצירת מדפסת חדשה',
            error: 'שגיאה ביצירת המדפסת',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Update printer
 */
router.post('/printers/:id/update', async (req, res) => {
    try {
        const { id } = req.params;
        const { model, ip, location, status, description } = req.body;
        
        const updateQuery = `
            UPDATE DATABOX 
            SET f1 = @status,
                f2 = @location,
                f3 = @model,
                f4 = @ip,
                f5 = @description
            WHERE name = @id
        `;
        
        await executeQuery(updateQuery, {
            id: id,
            status: status || 'Active',
            location: location || '',
            model: model || '',
            ip: ip || '',
            description: description || ''
        });
        
        req.session.successMessage = 'המדפסת עודכנה בהצלחה!';
        res.redirect(`/printers/${encodeURIComponent(id)}`);
    } catch (error) {
        logger.error('Update printer error:', error);
        req.session.errorMessage = 'שגיאה בעדכון המדפסת';
        res.redirect(`/printers/${encodeURIComponent(req.params.id)}`);
    }
});

/**
 * Delete printer
 */
router.post('/printers/:id/delete', async (req, res) => {
    try {
        const { id } = req.params;
        
        await executeQuery('DELETE FROM DATABOX WHERE name = @id', { id });
        await executeQuery('DELETE FROM CI WHERE CI_ID = @id', { id });
        
        req.session.successMessage = 'המדפסת נמחקה בהצלחה!';
        res.redirect('/printers');
    } catch (error) {
        logger.error('Delete printer error:', error);
        req.session.errorMessage = 'שגיאה במחיקת המדפסת';
        res.redirect(`/printers/${encodeURIComponent(id)}`);
    }
});

module.exports = router;

