/**
 * Authentication Middleware
 * Supports session, PIN, and NTLM authentication
 */

const logger = require('../utils/logger');

/**
 * Authenticate user middleware
 * Checks session, PIN, or NTLM for authenticated user
 */
async function authenticateUser(req, res, next) {
    // Skip authentication for auth routes and API routes
    if (req.path.startsWith('/auth') || req.path.startsWith('/api')) {
        return next();
    }
    
    // Check if user is authenticated via session
    if (req.session && req.session.user) {
        req.user = req.session.user;
        res.locals.user = req.session.user;
        return next();
    }
    
    // Check for PIN authentication
    if (req.session && req.session.pinAuthenticated) {
        req.user = {
            name: req.session.userName || 'Guest',
            isPinAuthenticated: true
        };
        res.locals.user = req.user;
        return next();
    }
    
    // Check for NTLM authentication (if enabled)
    try {
        const ntlmService = require('../services/ntlmService');
        if (ntlmService && ntlmService.isNTLMEnabled && ntlmService.isNTLMEnabled()) {
            const ntlmUser = await ntlmService.authenticateNTLM(req);
            if (ntlmUser) {
                req.session.user = ntlmUser;
                req.user = ntlmUser;
                res.locals.user = ntlmUser;
                return next();
            }
        }
    } catch (error) {
        // NTLM service might not exist, that's okay
        logger.warn('NTLM authentication check failed:', error.message);
    }
    
    // Store redirect URL for after login
    req.session.redirectAfterLogin = req.originalUrl;
    
    // Redirect to login
    res.redirect('/auth/login');
}

/**
 * Check if user has admin role
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.redirect('/auth/login');
    }
    
    const isAdmin = req.user.roles && req.user.roles.includes('itdepartment');
    const isPinAuth = req.session && req.session.pinAuthenticated;
    
    if (isAdmin || isPinAuth) {
        return next();
    }
    
    // Store redirect URL
    req.session.redirectAfterPin = req.originalUrl;
    res.redirect('/auth/pin');
}

/**
 * Optional authentication - doesn't redirect
 */
function optionalAuth(req, res, next) {
    if (req.session && req.session.user) {
        req.user = req.session.user;
    } else if (req.session && req.session.pinAuthenticated) {
        req.user = {
            name: req.session.userName || 'Guest',
            isPinAuthenticated: true
        };
    }
    next();
}

module.exports = {
    authenticateUser,
    requireAdmin,
    optionalAuth
};

