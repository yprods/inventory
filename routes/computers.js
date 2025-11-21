/**
 * Computers Routes
 */

const express = require('express');
const router = express.Router();
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Computers list page
 */
router.get('/computers', async (req, res) => {
    try {
        const { search, status, os, location } = req.query;
        
        let query = `
            SELECT TOP 100 
                CI.Name, CI.CI_ID, CI.CreatedAt,
                DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE (CI.Name LIKE @search OR DATABOX.f0 LIKE @search)
            AND DATABOX.f6 = 'Computer'
        `;
        
        const params = { search: `%${search || ''}%` };
        
        // Add filters
        if (status) {
            query += ` AND DATABOX.f1 = @status`;
            params.status = status;
        }
        if (os) {
            query += ` AND DATABOX.f3 LIKE @os`;
            params.os = `%${os}%`;
        }
        if (location) {
            query += ` AND DATABOX.f2 LIKE @location`;
            params.location = `%${location}%`;
        }
        
        query += ` ORDER BY CI.CreatedAt DESC`;
        
        const computers = await executeQuery(query, params);
        
        res.render('computers/index', {
            title: 'מחשבים',
            computers: computers || [],
            search: search || '',
            status: status || '',
            os: os || '',
            location: location || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Computers page error:', error);
        res.render('computers/index', {
            title: 'מחשבים',
            computers: [],
            error: 'שגיאה בטעינת המחשבים',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Computer details page
 */
router.get('/computers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT CI.*, DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE CI.CI_ID = @id OR CI.Name = @id
        `;
        
        const results = await executeQuery(query, { id });
        const computer = results[0] || null;
        
        if (!computer) {
            return res.status(404).render('error', {
                title: '404',
                message: 'מחשב לא נמצא'
            });
        }
        
        // Get attachments
        let attachments = [];
        try {
            attachments = await executeSqliteQuery(`
                SELECT * FROM FileAttachments WHERE ItemName = ?
            `, [computer.Name || computer.name]);
        } catch (err) {
            logger.warn('Could not load attachments:', err.message);
        }
        
        // Get connections
        let connections = [];
        try {
            const connectionService = require('../services/connectionMapService');
            connections = await connectionService.getItemConnections(computer.Name || computer.name);
        } catch (err) {
            logger.warn('Could not load connections:', err.message);
        }
        
        res.render('computers/details', {
            title: `מחשב - ${computer.Name || computer.name}`,
            computer: computer,
            attachments: attachments,
            connections: connections,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Computer details error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת פרטי המחשב'
        });
    }
});

/**
 * Create computer page
 */
router.get('/computers/create', (req, res) => {
    res.render('computers/create', {
        title: 'יצירת מחשב חדש',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Create computer
 */
router.post('/computers/create', async (req, res) => {
    try {
        const { name, model, os, cpu, ram, hdd, ip, location, status, user, description } = req.body;
        
        if (!name || !name.trim()) {
            return res.render('computers/create', {
                title: 'יצירת מחשב חדש',
                error: 'שם המחשב חובה',
                user: req.user || { name: 'Guest' }
            });
        }
        
        // Insert into CI
        await executeQuery(`
            INSERT INTO CI (Name, CI_ID, CreatedAt)
            VALUES (@name, @ciId, GETDATE())
        `, { name: name.trim(), ciId: name.trim() });
        
        // Insert into DATABOX with computer-specific fields
        const fieldValues = {
            name: name.trim(),
            f0: name.trim(), // Name
            f1: status || 'Active', // Status
            f2: location || '', // Location
            f3: os || '', // Operating System
            f4: cpu || '', // CPU
            f5: ram || '', // RAM
            f6: 'Computer', // Type
            f7: hdd || '', // HDD
            f8: ip || '', // IP Address
            f9: user || '', // Assigned User
            f10: model || '', // Model
            f11: description || '', // Description
            f12: new Date().toISOString(), // Created Date
            f13: req.user ? req.user.name : 'System' // Created By
        };
        
        const insertQuery = `
            INSERT INTO DATABOX (name, f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13)
            VALUES (@name, @f0, @f1, @f2, @f3, @f4, @f5, @f6, @f7, @f8, @f9, @f10, @f11, @f12, @f13)
        `;
        
        await executeQuery(insertQuery, fieldValues);
        
        // Create network item
        try {
            const networkItemService = require('../services/networkItemService');
            const userName = req.user ? req.user.name : 'System';
            await networkItemService.createNetworkItem(name.trim(), 'Computer', userName, fieldValues);
        } catch (err) {
            logger.warn('NetworkItemService failed:', err.message);
        }
        
        req.session.successMessage = `המחשב '${name}' נוצר בהצלחה!`;
        res.redirect(`/computers/${encodeURIComponent(name.trim())}`);
    } catch (error) {
        logger.error('Create computer error:', error);
        res.render('computers/create', {
            title: 'יצירת מחשב חדש',
            error: 'שגיאה ביצירת המחשב',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Update computer
 */
router.post('/computers/:id/update', async (req, res) => {
    try {
        const { id } = req.params;
        const { model, os, cpu, ram, hdd, ip, location, status, user, description } = req.body;
        
        const updateQuery = `
            UPDATE DATABOX 
            SET f1 = @status,
                f2 = @location,
                f3 = @os,
                f4 = @cpu,
                f5 = @ram,
                f7 = @hdd,
                f8 = @ip,
                f9 = @user,
                f10 = @model,
                f11 = @description
            WHERE name = @id
        `;
        
        await executeQuery(updateQuery, {
            id: id,
            status: status || 'Active',
            location: location || '',
            os: os || '',
            cpu: cpu || '',
            ram: ram || '',
            hdd: hdd || '',
            ip: ip || '',
            user: user || '',
            model: model || '',
            description: description || ''
        });
        
        req.session.successMessage = 'המחשב עודכן בהצלחה!';
        res.redirect(`/computers/${encodeURIComponent(id)}`);
    } catch (error) {
        logger.error('Update computer error:', error);
        req.session.errorMessage = 'שגיאה בעדכון המחשב';
        res.redirect(`/computers/${encodeURIComponent(req.params.id)}`);
    }
});

/**
 * Delete computer
 */
router.post('/computers/:id/delete', async (req, res) => {
    try {
        const { id } = req.params;
        
        await executeQuery('DELETE FROM DATABOX WHERE name = @id', { id });
        await executeQuery('DELETE FROM CI WHERE CI_ID = @id', { id });
        
        req.session.successMessage = 'המחשב נמחק בהצלחה!';
        res.redirect('/computers');
    } catch (error) {
        logger.error('Delete computer error:', error);
        req.session.errorMessage = 'שגיאה במחיקת המחשב';
        res.redirect(`/computers/${encodeURIComponent(id)}`);
    }
});

module.exports = router;

