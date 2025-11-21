/**
 * Home Routes
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Home/Index page - Main entry point (matching original app concept)
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

/**
 * Root route - redirect to home
 */
router.get('/', async (req, res) => {
    const search = req.query.search;
    if (search && search.trim()) {
        return res.redirect(`/datablocks?search=${encodeURIComponent(search.trim())}`);
    }
    res.redirect('/home');
});

/**
 * Datablocks page - Main search/view functionality (core concept from original app)
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
        
        // Query database for CI and DATABOX (matching original app structure)
        const query = `
            SELECT TOP 1 CI.*, DATABOX.* 
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name 
            WHERE CI.Name = @search OR CI.CI_ID = @search
        `;
        
        const results = await executeQuery(query, { search });
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
        // Get field values from form (f0-f50)
        const fieldValues = [];
        for (let i = 0; i <= 50; i++) {
            const fieldValue = req.body.fieldValues && req.body.fieldValues[i] 
                ? req.body.fieldValues[i] 
                : (req.body[`fieldValues[${i}]`] || null);
            fieldValues[i] = fieldValue && fieldValue.trim() ? fieldValue.trim() : null;
        }
        
        // Insert into CI table
        const insertCI = `
            INSERT INTO CI (Name, CI_ID, CreatedAt)
            VALUES (@name, @ciId, GETDATE())
        `;
        
        await executeQuery(insertCI, {
            name: search,
            ciId: search
        });
        
        // Insert into DATABOX
        const insertDatabox = `
            INSERT INTO DATABOX (name, f0, f1, f2, f3, f4, f5, f6, f7, f8, f9,
                f10, f11, f12, f13, f14, f15, f16, f17, f18, f19,
                f20, f21, f22, f23, f24, f25, f26, f27, f28, f29,
                f30, f31, f32, f33, f34, f35, f36, f37, f38, f39,
                f40, f41, f42, f43, f44, f45, f46, f47, f48, f49, f50)
            VALUES (@name, @f0, @f1, @f2, @f3, @f4, @f5, @f6, @f7, @f8, @f9,
                @f10, @f11, @f12, @f13, @f14, @f15, @f16, @f17, @f18, @f19,
                @f20, @f21, @f22, @f23, @f24, @f25, @f26, @f27, @f28, @f29,
                @f30, @f31, @f32, @f33, @f34, @f35, @f36, @f37, @f38, @f39,
                @f40, @f41, @f42, @f43, @f44, @f45, @f46, @f47, @f48, @f49, @f50)
        `;
        
        const params = { name: search };
        for (let i = 0; i <= 50; i++) {
            params[`f${i}`] = fieldValues[i] || null;
        }
        
        await executeQuery(insertDatabox, params);
        
        // Try to create network item (optional)
        try {
            const networkItemService = require('../services/networkItemService');
            const userName = req.user ? req.user.name : 'System';
            await networkItemService.createNetworkItem(search, itemType || 'CI', userName, fieldValues);
        } catch (err) {
            logger.warn('NetworkItemService failed:', err.message);
        }
        
        req.session.successMessage = `הפריט '${search}' נוצר בהצלחה!`;
        res.redirect(`/datablocks?search=${encodeURIComponent(search)}`);
    } catch (error) {
        logger.error('Create item error:', error);
        res.render('home/create', {
            title: 'יצירת פריט חדש',
            search: req.body.search || '',
            error: 'שגיאה ביצירת הפריט',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;

