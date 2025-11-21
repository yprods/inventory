/**
 * Permission Service
 * Manages user permissions and roles
 */

const { executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Initialize permission tables
 */
async function initializePermissionTables() {
    try {
        // Users table
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS Users (
                Id TEXT PRIMARY KEY,
                Username TEXT UNIQUE NOT NULL,
                DisplayName TEXT,
                Email TEXT,
                Department TEXT,
                Roles TEXT,
                Permissions TEXT,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Roles table
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS Roles (
                Id TEXT PRIMARY KEY,
                Name TEXT UNIQUE NOT NULL,
                Description TEXT,
                Permissions TEXT,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Permissions table
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS Permissions (
                Id TEXT PRIMARY KEY,
                Name TEXT UNIQUE NOT NULL,
                Description TEXT,
                Category TEXT,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // User-Role mapping
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS UserRoles (
                UserId TEXT NOT NULL,
                RoleId TEXT NOT NULL,
                PRIMARY KEY (UserId, RoleId),
                FOREIGN KEY (UserId) REFERENCES Users(Id),
                FOREIGN KEY (RoleId) REFERENCES Roles(Id)
            )
        `);
        
        // Initialize default roles
        await initializeDefaultRoles();
        
        logger.info('Permission tables initialized');
    } catch (error) {
        logger.error('Error initializing permission tables:', error);
    }
}

/**
 * Initialize default roles
 */
async function initializeDefaultRoles() {
    try {
        const defaultRoles = [
            {
                id: 'admin',
                name: 'Administrator',
                description: 'Full system access',
                permissions: ['*']
            },
            {
                id: 'itdepartment',
                name: 'IT Department',
                description: 'IT department access',
                permissions: ['computers.*', 'printers.*', 'appstore.*', 'import.*', 'audit.view']
            },
            {
                id: 'user',
                name: 'User',
                description: 'Standard user access',
                permissions: ['phonebook.view', 'phonebook.create', 'chat.*']
            },
            {
                id: 'viewer',
                name: 'Viewer',
                description: 'Read-only access',
                permissions: ['*.view']
            }
        ];
        
        for (const role of defaultRoles) {
            try {
                await executeSqliteQuery(`
                    INSERT OR IGNORE INTO Roles (Id, Name, Description, Permissions)
                    VALUES (?, ?, ?, ?)
                `, [role.id, role.name, role.description, JSON.stringify(role.permissions)]);
            } catch (err) {
                // Role already exists
            }
        }
    } catch (error) {
        logger.error('Error initializing default roles:', error);
    }
}

/**
 * Get user permissions
 */
async function getUserPermissions(username) {
    try {
        const users = await executeSqliteQuery(`
            SELECT * FROM Users WHERE Username = ?
        `, [username]);
        
        if (users.length === 0) {
            return getDefaultPermissions();
        }
        
        const user = users[0];
        let permissions = [];
        
        // Get permissions from user roles
        const userRoles = await executeSqliteQuery(`
            SELECT r.* FROM Roles r
            INNER JOIN UserRoles ur ON r.Id = ur.RoleId
            WHERE ur.UserId = ?
        `, [user.Id]);
        
        for (const role of userRoles) {
            const rolePerms = role.Permissions ? JSON.parse(role.Permissions) : [];
            permissions = permissions.concat(rolePerms);
        }
        
        // Add direct user permissions
        if (user.Permissions) {
            const userPerms = JSON.parse(user.Permissions);
            permissions = permissions.concat(userPerms);
        }
        
        // Remove duplicates and handle wildcards
        return normalizePermissions(permissions);
    } catch (error) {
        logger.error('Error getting user permissions:', error);
        return getDefaultPermissions();
    }
}

/**
 * Normalize permissions (handle wildcards)
 */
function normalizePermissions(permissions) {
    const normalized = new Set();
    
    // If has wildcard, grant all
    if (permissions.includes('*')) {
        return ['*'];
    }
    
    for (const perm of permissions) {
        if (perm.endsWith('.*')) {
            // Add all permissions in category
            const category = perm.replace('.*', '');
            normalized.add(`${category}.view`);
            normalized.add(`${category}.create`);
            normalized.add(`${category}.edit`);
            normalized.add(`${category}.delete`);
        } else {
            normalized.add(perm);
        }
    }
    
    return Array.from(normalized);
}

/**
 * Get default permissions
 */
function getDefaultPermissions() {
    return ['phonebook.view', 'chat.*'];
}

/**
 * Check if user has permission
 */
async function hasPermission(username, permission) {
    try {
        const permissions = await getUserPermissions(username);
        
        // Check for wildcard
        if (permissions.includes('*')) {
            return true;
        }
        
        // Check exact permission
        if (permissions.includes(permission)) {
            return true;
        }
        
        // Check category permission
        const parts = permission.split('.');
        if (parts.length === 2) {
            const categoryPerm = `${parts[0]}.*`;
            if (permissions.includes(categoryPerm)) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        logger.error('Error checking permission:', error);
        return false;
    }
}

/**
 * Create or update user
 */
async function createOrUpdateUser(userData) {
    try {
        const userId = userData.id || Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        
        await executeSqliteQuery(`
            INSERT OR REPLACE INTO Users (Id, Username, DisplayName, Email, Department, Roles, Permissions, UpdatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            userData.username,
            userData.displayName || userData.username,
            userData.email || null,
            userData.department || null,
            userData.roles ? JSON.stringify(userData.roles) : null,
            userData.permissions ? JSON.stringify(userData.permissions) : null,
            new Date().toISOString()
        ]);
        
        // Update user roles
        if (userData.roles && userData.roles.length > 0) {
            // Remove existing roles
            await executeSqliteQuery('DELETE FROM UserRoles WHERE UserId = ?', [userId]);
            
            // Add new roles
            for (const roleId of userData.roles) {
                await executeSqliteQuery(`
                    INSERT OR IGNORE INTO UserRoles (UserId, RoleId)
                    VALUES (?, ?)
                `, [userId, roleId]);
            }
        }
        
        return userId;
    } catch (error) {
        logger.error('Error creating/updating user:', error);
        throw error;
    }
}

/**
 * Get all roles
 */
async function getAllRoles() {
    try {
        return await executeSqliteQuery('SELECT * FROM Roles ORDER BY Name');
    } catch (error) {
        logger.error('Error getting roles:', error);
        return [];
    }
}

/**
 * Get all users
 */
async function getAllUsers() {
    try {
        const users = await executeSqliteQuery('SELECT * FROM Users ORDER BY Username');
        
        // Get roles for each user
        for (const user of users) {
            const userRoles = await executeSqliteQuery(`
                SELECT r.* FROM Roles r
                INNER JOIN UserRoles ur ON r.Id = ur.RoleId
                WHERE ur.UserId = ?
            `, [user.Id]);
            
            user.Roles = userRoles.map(r => r.Id);
        }
        
        return users;
    } catch (error) {
        logger.error('Error getting users:', error);
        return [];
    }
}

// Initialize on load
initializePermissionTables();

module.exports = {
    getUserPermissions,
    hasPermission,
    createOrUpdateUser,
    getAllRoles,
    getAllUsers,
    initializePermissionTables
};

