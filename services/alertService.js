/**
 * Alert Service
 * Manages system alerts and notifications
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

const ALERTS_FILE = path.join(__dirname, '../data/alerts.json');
const MAX_ALERTS = 100;

/**
 * Initialize alerts file
 */
async function initializeAlerts() {
    await fs.ensureDir(path.dirname(ALERTS_FILE));
    if (!(await fs.pathExists(ALERTS_FILE))) {
        await fs.writeJson(ALERTS_FILE, [], { spaces: 2 });
    }
}

/**
 * Create alert
 */
async function createAlert(alertData) {
    try {
        await initializeAlerts();
        
        const alerts = await fs.readJson(ALERTS_FILE);
        
        const alert = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            title: alertData.title || 'התראה',
            message: alertData.message,
            type: alertData.type || 'info', // info, warning, error, success
            priority: alertData.priority || 'normal', // low, normal, high, urgent
            createdBy: alertData.createdBy || 'System',
            createdAt: new Date().toISOString(),
            expiresAt: alertData.expiresAt || null,
            readBy: [],
            attachments: alertData.attachments || [],
            targetUsers: alertData.targetUsers || [], // Empty = all users
            targetRoles: alertData.targetRoles || []
        };
        
        alerts.unshift(alert);
        
        // Keep only last N alerts
        if (alerts.length > MAX_ALERTS) {
            alerts.splice(MAX_ALERTS);
        }
        
        await fs.writeJson(ALERTS_FILE, alerts, { spaces: 2 });
        
        logger.info(`Alert created: ${alert.id}`);
        return alert;
    } catch (error) {
        logger.error('Error creating alert:', error);
        throw error;
    }
}

/**
 * Get alerts for user
 */
async function getAlertsForUser(userName, userRoles = []) {
    try {
        await initializeAlerts();
        
        if (!(await fs.pathExists(ALERTS_FILE))) {
            return [];
        }
        
        const alerts = await fs.readJson(ALERTS_FILE);
        const now = new Date();
        
        // Filter alerts
        const userAlerts = alerts.filter(alert => {
            // Check expiration
            if (alert.expiresAt && new Date(alert.expiresAt) < now) {
                return false;
            }
            
            // Check target users
            if (alert.targetUsers && alert.targetUsers.length > 0) {
                if (!alert.targetUsers.includes(userName)) {
                    return false;
                }
            }
            
            // Check target roles
            if (alert.targetRoles && alert.targetRoles.length > 0) {
                const hasRole = alert.targetRoles.some(role => userRoles.includes(role));
                if (!hasRole) {
                    return false;
                }
            }
            
            return true;
        });
        
        return userAlerts;
    } catch (error) {
        logger.error('Error getting alerts:', error);
        return [];
    }
}

/**
 * Mark alert as read
 */
async function markAlertAsRead(alertId, userName) {
    try {
        await initializeAlerts();
        
        const alerts = await fs.readJson(ALERTS_FILE);
        const alert = alerts.find(a => a.id === alertId);
        
        if (alert) {
            if (!alert.readBy.includes(userName)) {
                alert.readBy.push(userName);
                await fs.writeJson(ALERTS_FILE, alerts, { spaces: 2 });
            }
        }
        
        return true;
    } catch (error) {
        logger.error('Error marking alert as read:', error);
        return false;
    }
}

/**
 * Delete alert
 */
async function deleteAlert(alertId, userName) {
    try {
        await initializeAlerts();
        
        const alerts = await fs.readJson(ALERTS_FILE);
        const filtered = alerts.filter(a => a.id !== alertId);
        
        await fs.writeJson(ALERTS_FILE, filtered, { spaces: 2 });
        
        logger.info(`Alert deleted: ${alertId} by ${userName}`);
        return true;
    } catch (error) {
        logger.error('Error deleting alert:', error);
        return false;
    }
}

/**
 * Get unread count
 */
async function getUnreadCount(userName, userRoles = []) {
    try {
        const alerts = await getAlertsForUser(userName, userRoles);
        return alerts.filter(a => !a.readBy.includes(userName)).length;
    } catch (error) {
        logger.error('Error getting unread count:', error);
        return 0;
    }
}

module.exports = {
    createAlert,
    getAlertsForUser,
    markAlertAsRead,
    deleteAlert,
    getUnreadCount
};

