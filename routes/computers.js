const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

router.get('/computers', async (req, res) => {
    try {
        const { search } = req.query;
        
        const useSQLite = isUsingSQLite();
        
        let query;
        let params;
        
        if (useSQLite) {
            query = `SELECT CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Computer' OR DATABOX.f6 LIKE '%Computer%')`;
            if (search) {
                query += ` AND (CI.Name LIKE ? OR DATABOX.f0 LIKE ?)`;
                params = [`%${search}%`, `%${search}%`];
            } else {
                params = [];
            }
            query += ` LIMIT 100`;
        } else {
            query = `SELECT TOP 100 CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Computer' OR DATABOX.f6 LIKE '%Computer%')`;
            if (search) {
                query += ` AND (CI.Name LIKE @search OR DATABOX.f0 LIKE @search)`;
                params = { search: `%${search}%` };
            } else {
                params = {};
            }
        }
        
        const computers = await executeQuery(query, params);
        
        res.render('computers/index', {
            title: 'מחשבים',
            computers: computers || [],
            search: search || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Computers page error:', error);
        res.render('computers/index', {
            title: 'מחשבים',
            computers: [],
            search: '',
            error: 'שגיאה בטעינת המחשבים',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;
