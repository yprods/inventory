/**
 * App Store Routes
 */

const express = require('express');
const router = express.Router();
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * App Store main page
 */
router.get('/appstore', async (req, res) => {
    try {
        const { category, search } = req.query;
        
        // Get all applications
        let query = `
            SELECT TOP 100 
                CI.Name, CI.CI_ID, CI.CreatedAt,
                DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE DATABOX.f6 = 'Application' OR DATABOX.f6 = 'App'
        `;
        
        const params = {};
        
        if (search) {
            query += ` AND (CI.Name LIKE @search OR DATABOX.f0 LIKE @search OR DATABOX.f5 LIKE @search)`;
            params.search = `%${search}%`;
        }
        
        if (category) {
            query += ` AND DATABOX.f1 = @category`;
            params.category = category;
        }
        
        query += ` ORDER BY CI.CreatedAt DESC`;
        
        const apps = await executeQuery(query, params);
        
        // Get categories
        const categories = await executeQuery(`
            SELECT DISTINCT f1 as category
            FROM DATABOX
            WHERE f6 = 'Application' OR f6 = 'App'
            AND f1 IS NOT NULL
            ORDER BY f1
        `);
        
        res.render('appstore/index', {
            title: 'חנות אפליקציות',
            apps: apps || [],
            categories: categories || [],
            search: search || '',
            category: category || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('App Store page error:', error);
        res.render('appstore/index', {
            title: 'חנות אפליקציות',
            apps: [],
            categories: [],
            error: 'שגיאה בטעינת האפליקציות',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * App details page
 */
router.get('/appstore/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT CI.*, DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE CI.CI_ID = @id OR CI.Name = @id
        `;
        
        const results = await executeQuery(query, { id });
        const app = results[0] || null;
        
        if (!app) {
            return res.status(404).render('error', {
                title: '404',
                message: 'אפליקציה לא נמצאה'
            });
        }
        
        // Get attachments
        let attachments = [];
        try {
            attachments = await executeSqliteQuery(`
                SELECT * FROM FileAttachments WHERE ItemName = ?
            `, [app.Name || app.name]);
        } catch (err) {
            logger.warn('Could not load attachments:', err.message);
        }
        
        // Get connections
        let connections = [];
        try {
            const connectionService = require('../services/connectionMapService');
            connections = await connectionService.getItemConnections(app.Name || app.name);
        } catch (err) {
            logger.warn('Could not load connections:', err.message);
        }
        
        res.render('appstore/details', {
            title: `${app.Name || app.name} - חנות אפליקציות`,
            app: app,
            attachments: attachments,
            connections: connections,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('App details error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת פרטי האפליקציה'
        });
    }
});

/**
 * Create app page
 */
router.get('/appstore/create', (req, res) => {
    res.render('appstore/create', {
        title: 'הוספת אפליקציה חדשה',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Create app
 */
router.post('/appstore/create', async (req, res) => {
    try {
        const { name, category, version, developer, description, downloadUrl, iconUrl, price, license } = req.body;
        
        if (!name || !name.trim()) {
            return res.render('appstore/create', {
                title: 'הוספת אפליקציה חדשה',
                error: 'שם האפליקציה חובה',
                user: req.user || { name: 'Guest' }
            });
        }
        
        // Insert into CI
        await executeQuery(`
            INSERT INTO CI (Name, CI_ID, CreatedAt)
            VALUES (@name, @ciId, GETDATE())
        `, { name: name.trim(), ciId: name.trim() });
        
        // Insert into DATABOX with app-specific fields
        const fieldValues = {
            name: name.trim(),
            f0: name.trim(), // Name
            f1: category || 'General', // Category
            f2: version || '1.0.0', // Version
            f3: developer || '', // Developer
            f4: price || '0', // Price
            f5: description || '', // Description
            f6: 'Application', // Type
            f7: downloadUrl || '', // Download URL
            f8: iconUrl || '', // Icon URL
            f9: license || 'Free', // License
            f10: new Date().toISOString(), // Created Date
            f11: req.user ? req.user.name : 'System' // Created By
        };
        
        const insertQuery = `
            INSERT INTO DATABOX (name, f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11)
            VALUES (@name, @f0, @f1, @f2, @f3, @f4, @f5, @f6, @f7, @f8, @f9, @f10, @f11)
        `;
        
        await executeQuery(insertQuery, fieldValues);
        
        // Create network item
        try {
            const networkItemService = require('../services/networkItemService');
            const userName = req.user ? req.user.name : 'System';
            await networkItemService.createNetworkItem(name.trim(), 'Application', userName, fieldValues);
        } catch (err) {
            logger.warn('NetworkItemService failed:', err.message);
        }
        
        req.session.successMessage = `האפליקציה '${name}' נוספה בהצלחה!`;
        res.redirect(`/appstore/${encodeURIComponent(name.trim())}`);
    } catch (error) {
        logger.error('Create app error:', error);
        res.render('appstore/create', {
            title: 'הוספת אפליקציה חדשה',
            error: 'שגיאה בהוספת האפליקציה',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Update app
 */
router.post('/appstore/:id/update', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, version, developer, description, downloadUrl, iconUrl, price, license } = req.body;
        
        const updateQuery = `
            UPDATE DATABOX 
            SET f1 = @category,
                f2 = @version,
                f3 = @developer,
                f4 = @price,
                f5 = @description,
                f7 = @downloadUrl,
                f8 = @iconUrl,
                f9 = @license
            WHERE name = @id
        `;
        
        await executeQuery(updateQuery, {
            id: id,
            category: category || 'General',
            version: version || '1.0.0',
            developer: developer || '',
            price: price || '0',
            description: description || '',
            downloadUrl: downloadUrl || '',
            iconUrl: iconUrl || '',
            license: license || 'Free'
        });
        
        req.session.successMessage = 'האפליקציה עודכנה בהצלחה!';
        res.redirect(`/appstore/${encodeURIComponent(id)}`);
    } catch (error) {
        logger.error('Update app error:', error);
        req.session.errorMessage = 'שגיאה בעדכון האפליקציה';
        res.redirect(`/appstore/${encodeURIComponent(req.params.id)}`);
    }
});

/**
 * Delete app
 */
router.post('/appstore/:id/delete', async (req, res) => {
    try {
        const { id } = req.params;
        
        await executeQuery('DELETE FROM DATABOX WHERE name = @id', { id });
        await executeQuery('DELETE FROM CI WHERE CI_ID = @id', { id });
        
        req.session.successMessage = 'האפליקציה נמחקה בהצלחה!';
        res.redirect('/appstore');
    } catch (error) {
        logger.error('Delete app error:', error);
        req.session.errorMessage = 'שגיאה במחיקת האפליקציה';
        res.redirect(`/appstore/${encodeURIComponent(id)}`);
    }
});

/**
 * Install app (creates connection)
 */
router.post('/appstore/:id/install', async (req, res) => {
    try {
        const { id } = req.params;
        const { computerId } = req.body;
        
        if (!computerId) {
            return res.status(400).json({ success: false, error: 'Computer ID required' });
        }
        
        // Create connection between app and computer
        const connectionService = require('../services/connectionMapService');
        await connectionService.createConnection(
            id,
            computerId,
            'installed-on',
            { installedAt: new Date().toISOString(), installedBy: req.user ? req.user.name : 'System' }
        );
        
        res.json({ success: true, message: 'האפליקציה הותקנה בהצלחה!' });
    } catch (error) {
        logger.error('Install app error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

