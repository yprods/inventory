const express = require('express');
const router = express.Router();
const { executeQuery, isUsingSQLite } = require('../config/database');
const logger = require('../utils/logger');

router.get('/phonebook', async (req, res) => {
    try {
        const { search } = req.query;
        
        const useSQLite = isUsingSQLite();
        
        let query;
        let params;
        
        if (useSQLite) {
            query = `SELECT CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Contact' OR DATABOX.f6 LIKE '%Contact%')`;
            if (search) {
                query += ` AND (CI.Name LIKE ? OR DATABOX.f0 LIKE ? OR DATABOX.f3 LIKE ?)`;
                params = [`%${search}%`, `%${search}%`, `%${search}%`];
            } else {
                params = [];
            }
            query += ` LIMIT 100`;
        } else {
            query = `SELECT TOP 100 CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Contact' OR DATABOX.f6 LIKE '%Contact%')`;
            if (search) {
                query += ` AND (CI.Name LIKE @search OR DATABOX.f0 LIKE @search OR DATABOX.f3 LIKE @search)`;
                params = { search: `%${search}%` };
            } else {
                params = {};
            }
        }
        
        const contacts = await executeQuery(query, params);
        
        res.render('phonebook/index', {
            title: 'ספר טלפונים',
            contacts: contacts || [],
            search: search || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Phonebook page error:', error);
        res.render('phonebook/index', {
            title: 'ספר טלפונים',
            contacts: [],
            search: '',
            error: 'שגיאה בטעינת ספר הטלפונים',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;
