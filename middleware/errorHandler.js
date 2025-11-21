/**
 * Error Handler Middleware
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    
    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'שגיאה פנימית בשרת' 
        : err.message;
    
    res.status(err.status || 500).render('error', {
        title: 'שגיאה',
        message: message
    });
}

module.exports = { errorHandler };

