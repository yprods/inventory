/**
 * Permission Middleware
 * Checks user permissions for routes
 */

const permissionService = require('../services/permissionService');
const logger = require('../utils/logger');

/**
 * Require permission middleware
 */
function requirePermission(permission) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).render('error', {
                    title: 'אין הרשאה',
                    message: 'נדרש להתחבר'
                });
            }
            
            const username = req.user.username || req.user.name;
            const hasPerm = await permissionService.hasPermission(username, permission);
            
            if (!hasPerm) {
                logger.warn(`Permission denied: ${username} tried to access ${permission}`);
                return res.status(403).render('error', {
                    title: 'אין הרשאה',
                    message: 'אין לך הרשאה לבצע פעולה זו'
                });
            }
            
            next();
        } catch (error) {
            logger.error('Permission check error:', error);
            res.status(500).render('error', {
                title: 'שגיאה',
                message: 'שגיאה בבדיקת הרשאות'
            });
        }
    };
}

/**
 * Require any of the permissions
 */
function requireAnyPermission(...permissions) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).render('error', {
                    title: 'אין הרשאה',
                    message: 'נדרש להתחבר'
                });
            }
            
            const username = req.user.username || req.user.name;
            
            for (const permission of permissions) {
                const hasPerm = await permissionService.hasPermission(username, permission);
                if (hasPerm) {
                    return next();
                }
            }
            
            logger.warn(`Permission denied: ${username} tried to access ${permissions.join(' or ')}`);
            return res.status(403).render('error', {
                title: 'אין הרשאה',
                message: 'אין לך הרשאה לבצע פעולה זו'
            });
        } catch (error) {
            logger.error('Permission check error:', error);
            res.status(500).render('error', {
                title: 'שגיאה',
                message: 'שגיאה בבדיקת הרשאות'
            });
        }
    };
}

/**
 * Require role middleware
 */
function requireRole(...roles) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).render('error', {
                    title: 'אין הרשאה',
                    message: 'נדרש להתחבר'
                });
            }
            
            const userRoles = req.user.roles || [];
            const hasRole = roles.some(role => userRoles.includes(role));
            
            if (!hasRole) {
                logger.warn(`Role denied: ${req.user.name} tried to access with roles: ${roles.join(', ')}`);
                return res.status(403).render('error', {
                    title: 'אין הרשאה',
                    message: 'אין לך הרשאה לבצע פעולה זו'
                });
            }
            
            next();
        } catch (error) {
            logger.error('Role check error:', error);
            res.status(500).render('error', {
                title: 'שגיאה',
                message: 'שגיאה בבדיקת תפקידים'
            });
        }
    };
}

module.exports = {
    requirePermission,
    requireAnyPermission,
    requireRole
};

