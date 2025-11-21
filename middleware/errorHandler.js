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
    
    // Set status code
    const statusCode = err.statusCode || err.status || 500;
    
    // Send error response
    if (req.accepts('html')) {
        // HTML response
        res.status(statusCode).render('error', {
            title: 'שגיאה',
            message: err.message || 'אירעה שגיאה',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    } else {
        // JSON response
        res.status(statusCode).json({
            success: false,
            error: err.message || 'An error occurred',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    }
}

module.exports = { errorHandler };

