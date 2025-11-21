/**
 * Search Routes
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Advanced search page
 */
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const results = [];
        
        if (query) {
            // Search in CI table
            const searchQuery = `
                SELECT TOP 50 CI.*, DATABOX.*
                FROM CI
                LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
                WHERE CI.Name LIKE @search OR CI.CI_ID LIKE @search
                ORDER BY CI.CreatedAt DESC
            `;
            
            const searchResults = await executeQuery(searchQuery, {
                search: `%${query}%`
            });
            
            results.push(...searchResults);
        }
        
        res.render('search/index', {
            title: 'חיפוש מתקדם',
            query: query,
            results: results,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Search error:', error);
        res.render('search/index', {
            title: 'חיפוש מתקדם',
            query: req.query.q || '',
            results: [],
            error: 'שגיאה בחיפוש',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;

