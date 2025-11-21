const express = require('express');
const router = express.Router();
const { executeQuery, isUsingSQLite } = require('../config/database');
const logger = require('../utils/logger');

router.get('/suppliers', async (req, res) => {
    try {
        const { search } = req.query;
        
        const useSQLite = isUsingSQLite();
        
        let query;
        let params;
        
        if (useSQLite) {
            query = `SELECT CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Supplier' OR DATABOX.f6 LIKE '%Supplier%')`;
            if (search) {
                query += ` AND (CI.Name LIKE ? OR DATABOX.f0 LIKE ?)`;
                params = [`%${search}%`, `%${search}%`];
            } else {
                params = [];
            }
            query += ` LIMIT 100`;
        } else {
            query = `SELECT TOP 100 CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Supplier' OR DATABOX.f6 LIKE '%Supplier%')`;
            if (search) {
                query += ` AND (CI.Name LIKE @search OR DATABOX.f0 LIKE @search)`;
                params = { search: `%${search}%` };
            } else {
                params = {};
            }
        }
        
        const suppliers = await executeQuery(query, params);
        
        res.render('suppliers/index', {
            title: 'ספקים',
            suppliers: suppliers || [],
            search: search || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Suppliers page error:', error);
        res.render('suppliers/index', {
            title: 'ספקים',
            suppliers: [],
            search: '',
            error: 'שגיאה בטעינת הספקים',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;
