/**
 * NTLM Authentication Service
 * Handles NTLM/SSO authentication
 */

const { executeSqliteQuery } = require('../config/database');
const permissionService = require('./permissionService');
const logger = require('../utils/logger');

/**
 * Authenticate user via NTLM
 */
async function authenticateNTLM(req) {
    try {
        // Get username from NTLM headers
        const username = req.headers['x-username'] || 
                       req.headers['remote-user'] || 
                       req.connection.user || 
                       null;
        
        if (!username) {
            return null;
        }
        
        // Get user from database
        const users = await executeSqliteQuery(`
            SELECT * FROM Users WHERE Username = ? OR Username = ?
        `, [username, username.toLowerCase()]);
        
        let user = null;
        
        if (users.length > 0) {
            user = users[0];
        } else {
            // Auto-create user from NTLM
            const userId = await permissionService.createOrUpdateUser({
                username: username,
                displayName: username,
                roles: ['user'] // Default role
            });
            
            const newUsers = await executeSqliteQuery('SELECT * FROM Users WHERE Id = ?', [userId]);
            user = newUsers[0];
        }
        
        // Get permissions
        const permissions = await permissionService.getUserPermissions(username);
        const roles = await executeSqliteQuery(`
            SELECT r.* FROM Roles r
            INNER JOIN UserRoles ur ON r.Id = ur.RoleId
            INNER JOIN Users u ON ur.UserId = u.Id
            WHERE u.Username = ?
        `, [username]);
        
        return {
            id: user.Id,
            name: user.DisplayName || user.Username,
            username: user.Username,
            email: user.Email,
            department: user.Department,
            roles: roles.map(r => r.Id),
            permissions: permissions,
            isNTLMAuthenticated: true
        };
    } catch (error) {
        logger.error('NTLM authentication error:', error);
        return null;
    }
}

/**
 * Check if NTLM is enabled
 */
function isNTLMEnabled() {
    return process.env.NTLM_ENABLED === 'true';
}

module.exports = {
    authenticateNTLM,
    isNTLMEnabled
};

