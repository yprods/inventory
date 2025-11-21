/**
 * Home Routes
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Home/Index page - Main entry point
 * If search parameter exists, redirect to datablocks
 */
router.get('/home', async (req, res) => {
    try {
        const search = req.query.search;
        
        // If search term provided, redirect to datablocks (matching original app behavior)
        if (search && search.trim()) {
            return res.redirect(`/datablocks?search=${encodeURIComponent(search.trim())}`);
        }
        
        const successMessage = req.session.successMessage;
        const errorMessage = req.session.errorMessage;
        delete req.session.successMessage;
        delete req.session.errorMessage;
        
        res.render('home/index', {
            title: 'דף הבית - ספר מערכת',
            user: req.user || { name: 'Guest' },
            successMessage: successMessage,
            errorMessage: errorMessage
        });
    } catch (error) {
        logger.error('Home page error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת הדף'
        });
    }
});

// Root route removed - handled in server.js to avoid conflicts

/**
 * Datablocks page - Main search/view functionality
 */
router.get('/datablocks', async (req, res) => {
    try {
        const search = req.query.search || '';
        
        if (!search) {
            return res.render('home/datablocks', {
                title: 'בלוקי נתונים',
                search: '',
                data: null,
                error: null,
                user: req.user || { name: 'Guest' }
            });
        }
        
        // Query database for CI and DATABOX
        let query;
        if (isUsingSQLite()) {
            query = `
                SELECT CI.*, DATABOX.* 
                FROM CI
                LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name 
                WHERE CI.Name = ? OR CI.CI_ID = ?
                LIMIT 1
            `;
        } else {
            query = `
                SELECT TOP 1 CI.*, DATABOX.* 
                FROM CI
                LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name 
                WHERE CI.Name = @search OR CI.CI_ID = @search
            `;
        }
        
        let results;
        if (isUsingSQLite()) {
            results = await executeQuery(query, [search, search]);
        } else {
            results = await executeQuery(query, { search });
        }
        const data = results[0] || null;
        
        const successMessage = req.session.successMessage;
        delete req.session.successMessage;
        
        res.render('home/datablocks', {
            title: data ? `${data.Name || search} - ספר מערכת` : 'בלוקי נתונים',
            search: search,
            search_name: data ? (data.Name || search) : search,
            data: data,
            error: null,
            user: req.user || { name: 'Guest' },
            successMessage: successMessage
        });
    } catch (error) {
        logger.error('Datablocks error:', error);
        res.render('home/datablocks', {
            title: 'בלוקי נתונים',
            search: req.query.search || '',
            data: null,
            error: 'שגיאה בטעינת הנתונים: ' + error.message,
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Create new item
 */
router.get('/create', (req, res) => {
    res.render('home/create', {
        title: 'יצירת פריט חדש',
        search: req.query.search || '',
        error: null,
        user: req.user || { name: 'Guest' }
    });
});

router.post('/create', async (req, res) => {
    try {
        const { search, itemType } = req.body;
        
        if (!search || !search.trim()) {
            return res.render('home/create', {
                title: 'יצירת פריט חדש',
                search: '',
                error: 'שם הפריט חובה',
                user: req.user || { name: 'Guest' }
            });
        }
        
        // Get field values from form (f0-f50)
        const fieldValues = {};
        for (let i = 0; i <= 50; i++) {
            const fieldValue = req.body[`f${i}`] || null;
            fieldValues[`f${i}`] = fieldValue && fieldValue.trim() ? fieldValue.trim() : null;
        }
        
        // Insert into CI table
        if (isUsingSQLite()) {
            const insertCI = `INSERT INTO CI (Name, CI_ID, CreatedAt) VALUES (?, ?, datetime('now'))`;
            await executeQuery(insertCI, [search.trim(), search.trim()]);
        } else {
            const insertCI = `INSERT INTO CI (Name, CI_ID, CreatedAt) VALUES (@name, @ciId, GETDATE())`;
            await executeQuery(insertCI, { name: search.trim(), ciId: search.trim() });
        }
        
        // Insert into DATABOX
        const fieldNames = ['name'];
        const fieldValuesList = [search.trim()];
        
        for (let i = 0; i <= 50; i++) {
            fieldNames.push(`f${i}`);
            fieldValuesList.push(fieldValues[`f${i}`] || null);
        }
        
        if (isUsingSQLite()) {
            // SQLite uses positional parameters
            const placeholders = fieldNames.map(() => '?').join(', ');
            const insertDatabox = `INSERT INTO DATABOX (${fieldNames.join(', ')}) VALUES (${placeholders})`;
            await executeQuery(insertDatabox, fieldValuesList);
        } else {
            // SQL Server uses named parameters
            const params = {};
            fieldNames.forEach((name, index) => {
                params[name] = fieldValuesList[index];
            });
            const placeholders = fieldNames.map(name => `@${name}`).join(', ');
            const insertDatabox = `INSERT INTO DATABOX (${fieldNames.join(', ')}) VALUES (${placeholders})`;
            await executeQuery(insertDatabox, params);
        }
        
        req.session.successMessage = `הפריט '${search}' נוצר בהצלחה!`;
        res.redirect(`/datablocks?search=${encodeURIComponent(search.trim())}`);
    } catch (error) {
        logger.error('Create item error:', error);
        res.render('home/create', {
            title: 'יצירת פריט חדש',
            search: req.body.search || '',
            error: 'שגיאה ביצירת הפריט: ' + error.message,
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;

