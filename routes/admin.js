/**
 * Admin Routes
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Admin dashboard
 */
router.get('/admin', requireAdmin, async (req, res) => {
    try {
        // Get statistics
        const stats = {
            totalCI: 0,
            totalNetworkItems: 0,
            recentItems: []
        };
        
        try {
            const ciCount = await executeQuery('SELECT COUNT(*) as count FROM CI');
            stats.totalCI = ciCount[0]?.count || 0;
        } catch (err) {
            logger.warn('Could not get CI count:', err.message);
        }
        
        try {
            const networkItems = await executeSqliteQuery('SELECT COUNT(*) as count FROM NetworkItems');
            stats.totalNetworkItems = networkItems[0]?.count || 0;
        } catch (err) {
            logger.warn('Could not get network items count:', err.message);
        }
        
        res.render('admin/dashboard', {
            title: 'לוח בקרה - מנהל',
            stats: stats,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Admin dashboard error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת לוח הבקרה'
        });
    }
});

/**
 * Database management
 */
router.get('/admin/database', requireAdmin, async (req, res) => {
    try {
        res.render('admin/database', {
            title: 'ניהול מסד נתונים',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Database management error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת הדף'
        });
    }
});

module.exports = router;

