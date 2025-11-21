/**
 * Audit Center Routes
 */

const express = require('express');
const router = express.Router();
const { executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

/**
 * Initialize audit tables
 */
async function initializeAuditTables() {
    try {
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS AuditLogs (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserName TEXT NOT NULL,
                Action TEXT NOT NULL,
                EntityType TEXT,
                EntityId TEXT,
                EntityName TEXT,
                Details TEXT,
                IpAddress TEXT,
                UserAgent TEXT,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await executeSqliteQuery(`
            CREATE INDEX IF NOT EXISTS idx_AuditLogs_UserName ON AuditLogs(UserName)
        `);
        
        await executeSqliteQuery(`
            CREATE INDEX IF NOT EXISTS idx_AuditLogs_CreatedAt ON AuditLogs(CreatedAt)
        `);
        
        await executeSqliteQuery(`
            CREATE INDEX IF NOT EXISTS idx_AuditLogs_Action ON AuditLogs(Action)
        `);
        
        logger.info('Audit tables initialized');
    } catch (error) {
        logger.error('Error initializing audit tables:', error);
    }
}

// Initialize on load
initializeAuditTables();

/**
 * Log audit event
 */
async function logAuditEvent(userName, action, entityType, entityId, entityName, details, req) {
    try {
        const ipAddress = req ? (req.ip || req.connection.remoteAddress) : 'Unknown';
        const userAgent = req ? (req.get('user-agent') || 'Unknown') : 'Unknown';
        
        await executeSqliteQuery(`
            INSERT INTO AuditLogs (UserName, Action, EntityType, EntityId, EntityName, Details, IpAddress, UserAgent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userName,
            action,
            entityType || null,
            entityId || null,
            entityName || null,
            details ? JSON.stringify(details) : null,
            ipAddress,
            userAgent
        ]);
    } catch (error) {
        logger.error('Error logging audit event:', error);
    }
}

/**
 * Audit center main page
 */
router.get('/audit', async (req, res) => {
    try {
        const { user, action, entityType, dateFrom, dateTo, limit } = req.query;
        
        let query = 'SELECT * FROM AuditLogs WHERE 1=1';
        const params = [];
        
        if (user) {
            query += ' AND UserName LIKE ?';
            params.push(`%${user}%`);
        }
        if (action) {
            query += ' AND Action = ?';
            params.push(action);
        }
        if (entityType) {
            query += ' AND EntityType = ?';
            params.push(entityType);
        }
        if (dateFrom) {
            query += ' AND CreatedAt >= ?';
            params.push(dateFrom);
        }
        if (dateTo) {
            query += ' AND CreatedAt <= ?';
            params.push(dateTo);
        }
        
        query += ' ORDER BY CreatedAt DESC LIMIT ?';
        params.push(parseInt(limit) || 100);
        
        const logs = await executeSqliteQuery(query, params);
        
        // Get statistics
        const stats = {
            total: 0,
            byAction: {},
            byUser: {},
            byEntityType: {}
        };
        
        const allLogs = await executeSqliteQuery('SELECT * FROM AuditLogs ORDER BY CreatedAt DESC LIMIT 1000');
        stats.total = allLogs.length;
        
        allLogs.forEach(log => {
            stats.byAction[log.Action] = (stats.byAction[log.Action] || 0) + 1;
            stats.byUser[log.UserName] = (stats.byUser[log.UserName] || 0) + 1;
            if (log.EntityType) {
                stats.byEntityType[log.EntityType] = (stats.byEntityType[log.EntityType] || 0) + 1;
            }
        });
        
        // Get unique values for filters
        const users = await executeSqliteQuery('SELECT DISTINCT UserName FROM AuditLogs ORDER BY UserName');
        const actions = await executeSqliteQuery('SELECT DISTINCT Action FROM AuditLogs ORDER BY Action');
        const entityTypes = await executeSqliteQuery('SELECT DISTINCT EntityType FROM AuditLogs WHERE EntityType IS NOT NULL ORDER BY EntityType');
        
        res.render('audit/index', {
            title: 'מרכז ביקורת',
            logs: logs.map(log => ({
                ...log,
                Details: log.Details ? JSON.parse(log.Details) : null
            })),
            stats: stats,
            users: users || [],
            actions: actions || [],
            entityTypes: entityTypes || [],
            filters: {
                user: user || '',
                action: action || '',
                entityType: entityType || '',
                dateFrom: dateFrom || '',
                dateTo: dateTo || ''
            },
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Audit center error:', error);
        res.render('audit/index', {
            title: 'מרכז ביקורת',
            logs: [],
            stats: { total: 0, byAction: {}, byUser: {}, byEntityType: {} },
            users: [],
            actions: [],
            entityTypes: [],
            error: 'שגיאה בטעינת יומן הביקורת',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Export audit logs
 */
router.get('/audit/export', async (req, res) => {
    try {
        const { format } = req.query;
        const logs = await executeSqliteQuery('SELECT * FROM AuditLogs ORDER BY CreatedAt DESC');
        
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
            res.json(logs);
        } else {
            // CSV format
            const csv = [
                'Id,UserName,Action,EntityType,EntityId,EntityName,Details,IpAddress,UserAgent,CreatedAt'
            ];
            
            logs.forEach(log => {
                csv.push([
                    log.Id,
                    log.UserName,
                    log.Action,
                    log.EntityType || '',
                    log.EntityId || '',
                    log.EntityName || '',
                    log.Details || '',
                    log.IpAddress || '',
                    log.UserAgent || '',
                    log.CreatedAt
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
            });
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
            res.send(csv.join('\n'));
        }
    } catch (error) {
        logger.error('Export audit logs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get audit log details
 */
router.get('/audit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await executeSqliteQuery('SELECT * FROM AuditLogs WHERE Id = ?', [id]);
        
        if (logs.length === 0) {
            return res.status(404).render('error', {
                title: '404',
                message: 'רשומת ביקורת לא נמצאה'
            });
        }
        
        const log = logs[0];
        log.Details = log.Details ? JSON.parse(log.Details) : null;
        
        res.render('audit/details', {
            title: `פרטי ביקורת - ${log.Id}`,
            log: log,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Audit log details error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת פרטי הביקורת'
        });
    }
});

module.exports = { router, logAuditEvent };

