/**
 * Permissions Management Routes
 */

const express = require('express');
const router = express.Router();
const permissionService = require('../services/permissionService');
const { requireRole } = require('../middleware/permissions');
const logger = require('../utils/logger');

/**
 * Permissions management page (admin only)
 */
router.get('/permissions', requireRole('admin', 'itdepartment'), async (req, res) => {
    try {
        const users = await permissionService.getAllUsers();
        const roles = await permissionService.getAllRoles();
        
        res.render('permissions/index', {
            title: 'ניהול הרשאות',
            users: users,
            roles: roles,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Permissions page error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת ניהול ההרשאות'
        });
    }
});

/**
 * User permissions page
 */
router.get('/permissions/user/:username', requireRole('admin', 'itdepartment'), async (req, res) => {
    try {
        const { username } = req.params;
        const permissions = await permissionService.getUserPermissions(username);
        const roles = await permissionService.getAllRoles();
        
        // Get user info
        const users = await permissionService.getAllUsers();
        const user = users.find(u => u.Username === username);
        
        res.render('permissions/user', {
            title: `הרשאות - ${username}`,
            user: user,
            permissions: permissions,
            roles: roles,
            currentUser: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('User permissions page error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת הרשאות המשתמש'
        });
    }
});

/**
 * Update user permissions
 */
router.post('/permissions/user/:username', requireRole('admin'), async (req, res) => {
    try {
        const { username } = req.params;
        const { roles, permissions } = req.body;
        
        const roleArray = roles ? (Array.isArray(roles) ? roles : [roles]) : [];
        const permArray = permissions ? (Array.isArray(permissions) ? permissions : [permissions]) : [];
        
        await permissionService.createOrUpdateUser({
            username: username,
            roles: roleArray,
            permissions: permArray
        });
        
        req.session.successMessage = 'הרשאות המשתמש עודכנו בהצלחה!';
        res.redirect(`/permissions/user/${encodeURIComponent(username)}`);
    } catch (error) {
        logger.error('Update user permissions error:', error);
        req.session.errorMessage = 'שגיאה בעדכון ההרשאות';
        res.redirect(`/permissions/user/${encodeURIComponent(req.params.username)}`);
    }
});

/**
 * Create new role
 */
router.post('/permissions/roles/create', requireRole('admin'), async (req, res) => {
    try {
        const { name, description, permissions } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, error: 'Role name required' });
        }
        
        const roleId = name.toLowerCase().replace(/\s+/g, '-');
        const permArray = permissions ? (Array.isArray(permissions) ? permissions : [permissions]) : [];
        
        const { executeSqliteQuery } = require('../config/database');
        await executeSqliteQuery(`
            INSERT OR REPLACE INTO Roles (Id, Name, Description, Permissions)
            VALUES (?, ?, ?, ?)
        `, [roleId, name, description || '', JSON.stringify(permArray)]);
        
        res.json({ success: true, roleId });
    } catch (error) {
        logger.error('Create role error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

