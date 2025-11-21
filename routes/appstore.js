const express = require('express');
const router = express.Router();
const { executeQuery, isUsingSQLite } = require('../config/database');
const logger = require('../utils/logger');

router.get('/appstore', async (req, res) => {
    try {
        const { search } = req.query;
        
        const useSQLite = isUsingSQLite();
        
        let query;
        let params;
        
        if (useSQLite) {
            query = `SELECT CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Application' OR DATABOX.f6 LIKE '%Application%' OR DATABOX.f6 LIKE '%App%')`;
            if (search) {
                query += ` AND (CI.Name LIKE ? OR DATABOX.f0 LIKE ?)`;
                params = [`%${search}%`, `%${search}%`];
            } else {
                params = [];
            }
            query += ` LIMIT 100`;
        } else {
            query = `SELECT TOP 100 CI.*, DATABOX.* FROM CI LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name WHERE (DATABOX.f6 = 'Application' OR DATABOX.f6 LIKE '%Application%' OR DATABOX.f6 LIKE '%App%')`;
            if (search) {
                query += ` AND (CI.Name LIKE @search OR DATABOX.f0 LIKE @search)`;
                params = { search: `%${search}%` };
            } else {
                params = {};
            }
        }
        
        const apps = await executeQuery(query, params);
        
        res.render('appstore/index', {
            title: 'חנות אפליקציות',
            apps: apps || [],
            search: search || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Appstore page error:', error);
        res.render('appstore/index', {
            title: 'חנות אפליקציות',
            apps: [],
            search: '',
            error: 'שגיאה בטעינת האפליקציות',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;
