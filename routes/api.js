const express = require('express');
const router = express.Router();

// Basic API endpoints
router.get('/api/status', (req, res) => {
    const { getDatabaseType, isConnected } = require('../config/database');
    res.json({
        success: true,
        status: 'online',
        database: getDatabaseType(),
        connected: isConnected()
    });
});

router.get('*', (req, res) => {
    res.json({ success: false, error: 'API endpoint not found' });
});

module.exports = router;
