/**
 * Alerts Routes
 */

const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const logger = require('../utils/logger');

/**
 * Alerts page
 */
router.get('/alerts', async (req, res) => {
    try {
        const userName = req.user ? req.user.name : 'Guest';
        const userRoles = req.user && req.user.roles ? req.user.roles : [];
        
        const alerts = await alertService.getAlertsForUser(userName, userRoles);
        const unreadCount = await alertService.getUnreadCount(userName, userRoles);
        
        res.render('alerts/index', {
            title: 'התראות',
            alerts: alerts,
            unreadCount: unreadCount,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Alerts page error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת ההתראות'
        });
    }
});

/**
 * Create alert page
 */
router.get('/alerts/create', (req, res) => {
    res.render('alerts/create', {
        title: 'יצירת התראה',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Create alert
 */
router.post('/alerts/create', async (req, res) => {
    try {
        const { title, message, type, priority, expiresAt, targetUsers, targetRoles } = req.body;
        
        if (!message || !message.trim()) {
            return res.render('alerts/create', {
                title: 'יצירת התראה',
                error: 'הודעה חובה',
                user: req.user || { name: 'Guest' }
            });
        }
        
        const userName = req.user ? req.user.name : 'System';
        
        const alert = await alertService.createAlert({
            title: title || 'התראה',
            message: message.trim(),
            type: type || 'info',
            priority: priority || 'normal',
            expiresAt: expiresAt || null,
            targetUsers: targetUsers ? targetUsers.split(',').map(u => u.trim()) : [],
            targetRoles: targetRoles ? targetRoles.split(',').map(r => r.trim()) : [],
            createdBy: userName
        });
        
        req.session.successMessage = 'ההתראה נוצרה בהצלחה!';
        res.redirect('/alerts');
    } catch (error) {
        logger.error('Create alert error:', error);
        res.render('alerts/create', {
            title: 'יצירת התראה',
            error: 'שגיאה ביצירת ההתראה',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;

