const express = require('express');
const router = express.Router();
const { executeQuery, isUsingSQLite } = require('../config/database');
const logger = require('../utils/logger');

router.get('/connections/map', async (req, res) => {
    try {
        const useSQLite = isUsingSQLite();
        
        let query;
        if (useSQLite) {
            query = 'SELECT CI.Name, CI.CI_ID FROM CI LIMIT 50';
        } else {
            query = 'SELECT TOP 50 CI.Name, CI.CI_ID FROM CI';
        }
        
        const items = await executeQuery(query, {});
        
        res.render('connections/map', {
            title: 'מפת קשרים',
            items: items || [],
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Connections map error:', error);
        res.render('connections/map', {
            title: 'מפת קשרים',
            items: [],
            error: 'שגיאה בטעינת מפת הקשרים',
            user: req.user || { name: 'Guest' }
        });
    }
});

router.get('/connections/item/:name', async (req, res) => {
    try {
        const { name } = req.params;
        
        const useSQLite = isUsingSQLite();
        
        let query;
        let params;
        if (useSQLite) {
            query = `SELECT CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE CI.Name = ? OR CI.CI_ID = ? LIMIT 1`;
            params = [name, name];
        } else {
            query = `SELECT TOP 1 CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE CI.Name = @name OR CI.CI_ID = @name`;
            params = { name };
        }
        
        const items = await executeQuery(query, params);
        const item = items[0] || null;
        
        res.render('connections/item', {
            title: `קשרים - ${name}`,
            item: item,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Connections item error:', error);
        res.render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת הקשרים'
        });
    }
});

module.exports = router;
