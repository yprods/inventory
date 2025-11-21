/**
 * Audit Middleware
 * Logs all important actions
 */

const { logAuditEvent } = require('../routes/audit');

/**
 * Audit middleware - logs actions
 */
function auditMiddleware(action, entityType) {
    return async (req, res, next) => {
        // Log after response is sent
        const originalSend = res.send;
        res.send = function(data) {
            const userName = req.user ? req.user.name : 'Guest';
            const entityId = req.params.id || req.body.id || null;
            const entityName = req.body.name || req.params.id || null;
            
            // Extract relevant details
            const details = {
                method: req.method,
                path: req.path,
                body: req.method === 'POST' || req.method === 'PUT' ? req.body : null
            };
            
            logAuditEvent(userName, action, entityType, entityId, entityName, details, req);
            
            return originalSend.call(this, data);
        };
        
        next();
    };
}

module.exports = { auditMiddleware };

