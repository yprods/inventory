/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// PIN code from environment or default
const PIN_CODE = process.env.PIN_CODE || '4231';

/**
 * Login page
 */
router.get('/login', (req, res) => {
    if (req.session.user || req.session.pinAuthenticated) {
        return res.redirect('/home');
    }
    res.render('auth/login', {
        title: 'התחברות',
        error: null
    });
});

/**
 * PIN login page
 */
router.get('/pin', (req, res) => {
    res.render('auth/pin', {
        title: 'אימות PIN',
        error: null
    });
});

/**
 * PIN authentication
 */
router.post('/pin', (req, res) => {
    const { pin } = req.body;
    const trimmedPin = (pin || '').trim();
    
    if (trimmedPin === PIN_CODE) {
        req.session.pinAuthenticated = true;
        req.session.userName = req.body.userName || 'Guest';
        
        logger.info('PIN authentication successful');
        
        // Redirect to stored URL or home
        const redirectUrl = req.session.redirectAfterPin || '/home';
        delete req.session.redirectAfterPin;
        
        res.redirect(redirectUrl);
    } else {
        logger.warn('Invalid PIN attempt');
        res.render('auth/pin', {
            title: 'אימות PIN',
            error: 'PIN שגוי. נסה שוב.'
        });
    }
});

/**
 * Logout
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logger.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
});

module.exports = router;

