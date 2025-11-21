/**
 * Chat Routes
 */

const express = require('express');
const router = express.Router();

/**
 * Chat page
 */
router.get('/', (req, res) => {
    res.render('chat/index', {
        title: 'צ\'אט צוות',
        user: req.user,
        layout: false // Chat has its own layout
    });
});

module.exports = router;

