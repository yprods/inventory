const express = require('express');
const router = express.Router();

router.get('/permissions', (req, res) => {
    res.render('permissions/index', {
        title: 'ניהול הרשאות',
        user: req.user || { name: 'Guest' }
    });
});

module.exports = router;
