const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

router.get('/audit', async (req, res) => {
    try {
        // Get audit logs from SQLite or file
        const auditFile = path.join(__dirname, '../data/audit.json');
        let logs = [];
        
        if (await fs.pathExists(auditFile)) {
            try {
                logs = await fs.readJson(auditFile);
            } catch (err) {
                logger.warn('Error reading audit file:', err.message);
            }
        }
        
        // Sort by date descending
        logs.sort((a, b) => new Date(b.CreatedAt || b.Timestamp) - new Date(a.CreatedAt || a.Timestamp));
        
        res.render('audit/index', {
            title: 'מרכז ביקורת',
            logs: logs.slice(0, 100), // Limit to 100 most recent
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Audit page error:', error);
        res.render('audit/index', {
            title: 'מרכז ביקורת',
            logs: [],
            error: 'שגיאה בטעינת יומן הביקורת',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = { router };
