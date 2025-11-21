/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Login page
 */
router.get('/auth/login', (req, res) => {
    // If already authenticated, redirect to home
    if (req.session && (req.session.user || req.session.pinAuthenticated)) {
        return res.redirect('/home');
    }
    
    res.render('auth/login', {
        title: 'התחברות',
        error: null,
        user: null
    });
});

/**
 * Handle login
 */
router.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simple authentication (replace with proper auth in production)
    if (username && password) {
        req.session.user = {
            name: username,
            username: username
        };
        
        const redirectUrl = req.session.redirectAfterLogin || '/home';
        delete req.session.redirectAfterLogin;
        
        return res.redirect(redirectUrl);
    }
    
    res.render('auth/login', {
        title: 'התחברות',
        error: 'שם משתמש או סיסמה שגויים',
        user: null
    });
});

/**
 * PIN login page
 */
router.get('/auth/pin', (req, res) => {
    res.render('auth/pin', {
        title: 'אימות PIN',
        error: null,
        user: null
    });
});

/**
 * Handle PIN authentication
 */
router.post('/auth/pin', (req, res) => {
    const pin = req.body.pin ? req.body.pin.trim() : '';
    const correctPin = process.env.PIN_CODE || '4231';
    
    if (pin === correctPin) {
        req.session.pinAuthenticated = true;
        req.session.userName = req.body.username || 'Guest';
        
        const redirectUrl = req.session.redirectAfterPin || '/home';
        delete req.session.redirectAfterPin;
        
        return res.redirect(redirectUrl);
    }
    
    res.render('auth/pin', {
        title: 'אימות PIN',
        error: 'PIN שגוי',
        user: null
    });
});

/**
 * Logout
 */
router.get('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logger.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
});

module.exports = router;

