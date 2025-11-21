const express = require('express');
const router = express.Router();

router.get('/chat', (req, res) => {
    res.render('chat/index', {
        title: 'צ\'אט צוות',
        user: req.user || { name: 'Guest' }
    });
});

module.exports = router;
