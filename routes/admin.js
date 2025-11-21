const express = require('express');
const router = express.Router();
const { executeQuery, getDatabaseType, isConnected } = require('../config/database');
const logger = require('../utils/logger');

router.get('/admin', async (req, res) => {
    try {
        const dbType = getDatabaseType();
        const dbConnected = isConnected();
        
        // Get some stats
        let itemCount = 0;
        try {
            const items = await executeQuery('SELECT COUNT(*) as count FROM CI', {});
            itemCount = items[0]?.count || 0;
        } catch (err) {
            logger.warn('Could not get item count:', err.message);
        }
        
        res.render('admin/dashboard', {
            title: 'מנהל מערכת',
            user: req.user || { name: 'Guest' },
            dbType: dbType,
            dbConnected: dbConnected,
            itemCount: itemCount
        });
    } catch (error) {
        logger.error('Admin page error:', error);
        res.render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת דף המנהל'
        });
    }
});

module.exports = router;
