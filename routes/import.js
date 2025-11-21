const express = require('express');
const router = express.Router();
const { getDatabaseType, isConnected } = require('../config/database');

router.get('/import', (req, res) => {
    const dbType = getDatabaseType();
    const dbConnected = isConnected();
    
    res.render('import/index', {
        title: 'מרכז ייבוא נתונים',
        dbType: dbType,
        dbConnected: dbConnected,
        user: req.user || { name: 'Guest' }
    });
});

module.exports = router;
