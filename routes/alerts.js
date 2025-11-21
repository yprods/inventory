const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

router.get('/alerts', async (req, res) => {
    try {
        const alertsFile = path.join(__dirname, '../data/alerts.json');
        let alerts = [];
        
        if (await fs.pathExists(alertsFile)) {
            try {
                alerts = await fs.readJson(alertsFile);
            } catch (err) {
                logger.warn('Error reading alerts file:', err.message);
            }
        }
        
        // Sort by date descending
        alerts.sort((a, b) => new Date(b.Timestamp || b.SubmittedDate) - new Date(a.Timestamp || a.SubmittedDate));
        
        res.render('alerts/index', {
            title: 'התראות',
            alerts: alerts || [],
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Alerts page error:', error);
        res.render('alerts/index', {
            title: 'התראות',
            alerts: [],
            error: 'שגיאה בטעינת ההתראות',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;
