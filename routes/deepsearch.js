/**
 * Deep Search Routes
 */

const express = require('express');
const router = express.Router();
const deepSearchService = require('../services/deepSearchService');
const logger = require('../utils/logger');

/**
 * Deep search page
 */
router.get('/deepsearch', async (req, res) => {
    try {
        const { q, exact, tables, fields } = req.query;
        
        let results = null;
        if (q) {
            results = await deepSearchService.deepSearch(q, {
                exactMatch: exact === 'true',
                tables: tables ? tables.split(',') : ['all'],
                fields: fields ? fields.split(',') : ['all']
            });
        }
        
        res.render('search/deep', {
            title: 'חיפוש עמוק',
            query: q || '',
            results: results,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Deep search page error:', error);
        res.render('search/deep', {
            title: 'חיפוש עמוק',
            query: req.query.q || '',
            results: null,
            error: 'שגיאה בחיפוש',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;

