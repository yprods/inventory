/**
 * API Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const chatManager = require('../services/chatManager');
const fileAttachmentService = require('../services/fileAttachmentService');
const connectionMapService = require('../services/connectionMapService');
const deepSearchService = require('../services/deepSearchService');
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const tempDir = path.join(__dirname, '../uploads/attachments/temp');
        await fs.ensureDir(tempDir);
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: fileAttachmentService.MAX_FILE_SIZE }
});

/**
 * Get chat messages
 */
router.get('/chat/messages', async (req, res) => {
    try {
        const messages = chatManager.getMessages();
        res.json({ success: true, messages });
    } catch (error) {
        logger.error('Get chat messages error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send chat message
 */
router.post('/chat/send', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message cannot be empty' });
        }
        
        const userName = req.user.name || 'Guest';
        const chatMessage = chatManager.addMessage(userName, message.trim());
        
        res.json({ success: true, message: chatMessage });
    } catch (error) {
        logger.error('Send chat message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Upload file for chat
 */
router.post('/chat/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const userName = req.user ? req.user.name : 'Guest';
        const fileInfo = await fileAttachmentService.attachFileToChat(
            Date.now().toString(),
            req.file,
            userName
        );
        
        // Add file info for chat
        const chatFileInfo = {
            originalName: fileInfo.originalName,
            filename: fileInfo.filename,
            url: fileInfo.url,
            size: fileInfo.size,
            mimeType: fileInfo.mimeType
        };
        
        res.json({ success: true, file: chatFileInfo });
    } catch (error) {
        logger.error('Chat file upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get online users
 */
router.get('/chat/users', (req, res) => {
    try {
        const users = chatManager.getOnlineUsers();
        res.json({ success: true, users });
    } catch (error) {
        logger.error('Get online users error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get alerts for current user
 */
router.get('/alerts', async (req, res) => {
    try {
        const alertService = require('../services/alertService');
        const userName = req.user ? req.user.name : 'Guest';
        const userRoles = req.user && req.user.roles ? req.user.roles : [];
        
        const alerts = await alertService.getAlertsForUser(userName, userRoles);
        res.json({ success: true, alerts });
    } catch (error) {
        logger.error('Get alerts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get unread alerts count
 */
router.get('/alerts/unread-count', async (req, res) => {
    try {
        const alertService = require('../services/alertService');
        const userName = req.user ? req.user.name : 'Guest';
        const userRoles = req.user && req.user.roles ? req.user.roles : [];
        
        const count = await alertService.getUnreadCount(userName, userRoles);
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Get unread count error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Mark alert as read
 */
router.post('/alerts/:alertId/read', async (req, res) => {
    try {
        const alertService = require('../services/alertService');
        const { alertId } = req.params;
        const userName = req.user ? req.user.name : 'Guest';
        
        await alertService.markAlertAsRead(alertId, userName);
        res.json({ success: true });
    } catch (error) {
        logger.error('Mark alert as read error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete alert
 */
router.delete('/alerts/:alertId', async (req, res) => {
    try {
        const alertService = require('../services/alertService');
        const { alertId } = req.params;
        const userName = req.user ? req.user.name : 'Guest';
        
        await alertService.deleteAlert(alertId, userName);
        res.json({ success: true });
    } catch (error) {
        logger.error('Delete alert error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Deep search endpoint
 */
router.post('/search/deep', async (req, res) => {
    try {
        const { searchTerm, options } = req.body;
        if (!searchTerm || !searchTerm.trim()) {
            return res.status(400).json({ success: false, error: 'Search term required' });
        }
        
        const results = await deepSearchService.deepSearch(searchTerm.trim(), options || {});
        res.json({ success: true, results });
    } catch (error) {
        logger.error('Deep search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get search suggestions
 */
router.get('/search/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ success: true, suggestions: [] });
        }
        
        const suggestions = await deepSearchService.getSearchSuggestions(q, 10);
        res.json({ success: true, suggestions });
    } catch (error) {
        logger.error('Get suggestions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Attach file to item
 */
router.post('/attachments/attach', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const { itemName } = req.body;
        if (!itemName) {
            return res.status(400).json({ success: false, error: 'Item name required' });
        }
        
        const userName = req.user ? req.user.name : 'Guest';
        const attachment = await fileAttachmentService.attachFileToItem(
            itemName,
            req.file,
            userName
        );
        
        res.json({ success: true, attachment });
    } catch (error) {
        logger.error('Attach file error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get item attachments
 */
router.get('/attachments/item/:itemName', async (req, res) => {
    try {
        const { itemName } = req.params;
        const attachments = await fileAttachmentService.getItemAttachments(itemName);
        res.json({ success: true, attachments });
    } catch (error) {
        logger.error('Get attachments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Download attachment
 */
router.get('/attachments/download/:attachmentId', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const attachments = await executeSqliteQuery(`
            SELECT * FROM FileAttachments WHERE Id = ?
        `, [attachmentId]);
        
        if (attachments.length === 0) {
            return res.status(404).json({ success: false, error: 'Attachment not found' });
        }
        
        const attachment = attachments[0];
        if (await fs.pathExists(attachment.Path)) {
            res.download(attachment.Path, attachment.OriginalName);
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (error) {
        logger.error('Download attachment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete attachment
 */
router.delete('/attachments/:attachmentId', async (req, res) => {
    try {
        const { attachmentId } = req.params;
        await fileAttachmentService.deleteAttachment(attachmentId);
        res.json({ success: true, message: 'Attachment deleted' });
    } catch (error) {
        logger.error('Delete attachment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create connection
 */
router.post('/connections/create', async (req, res) => {
    try {
        const { sourceItem, targetItem, connectionType, metadata } = req.body;
        if (!sourceItem || !targetItem) {
            return res.status(400).json({ success: false, error: 'Source and target items required' });
        }
        
        const connection = await connectionMapService.createConnection(
            sourceItem,
            targetItem,
            connectionType,
            metadata
        );
        
        res.json({ success: true, connection });
    } catch (error) {
        logger.error('Create connection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get item connections
 */
router.get('/connections/item/:itemName', async (req, res) => {
    try {
        const { itemName } = req.params;
        const connections = await connectionMapService.getItemConnections(itemName);
        res.json({ success: true, connections });
    } catch (error) {
        logger.error('Get connections error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get full connection map
 */
router.get('/connections/map', async (req, res) => {
    try {
        const map = await connectionMapService.getFullConnectionMap();
        res.json({ success: true, map });
    } catch (error) {
        logger.error('Get connection map error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get connection path
 */
router.get('/connections/path', async (req, res) => {
    try {
        const { source, target, maxDepth } = req.query;
        if (!source || !target) {
            return res.status(400).json({ success: false, error: 'Source and target required' });
        }
        
        const path = await connectionMapService.getConnectionPath(
            source,
            target,
            parseInt(maxDepth) || 5
        );
        
        res.json({ success: true, path });
    } catch (error) {
        logger.error('Get connection path error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Auto-detect connections
 */
router.post('/connections/auto-detect/:itemName', async (req, res) => {
    try {
        const { itemName } = req.params;
        const connections = await connectionMapService.autoDetectConnections(itemName);
        res.json({ success: true, connections, count: connections.length });
    } catch (error) {
        logger.error('Auto-detect connections error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Submit comment
 */
router.post('/comments/submit', async (req, res) => {
    try {
        const { search, subject, message, mediaFile } = req.body;
        const userName = req.user ? req.user.name : 'Guest';
        
        if (!search || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const comment = {
            Search: search,
            Subject: subject,
            Message: message,
            User: userName,
            SubmittedDate: new Date().toISOString(),
            MediaFileName: mediaFile || null
        };
        
        // Save comment to file (similar to original app)
        const commentsDir = path.join(__dirname, '../data/comments');
        await fs.ensureDir(commentsDir);
        
        const commentFile = path.join(commentsDir, `${search}_${Date.now()}.json`);
        await fs.writeJson(commentFile, comment, { spaces: 2 });
        
        res.json({ success: true, comment });
    } catch (error) {
        logger.error('Submit comment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get comments for a search term
 */
router.get('/comments/get', async (req, res) => {
    try {
        const { search } = req.query;
        
        if (!search) {
            return res.json({ success: true, comments: [] });
        }
        
        const commentsDir = path.join(__dirname, '../data/comments');
        const comments = [];
        
        if (await fs.pathExists(commentsDir)) {
            const files = await fs.readdir(commentsDir);
            for (const file of files) {
                if (file.startsWith(search + '_') && file.endsWith('.json')) {
                    try {
                        const comment = await fs.readJson(path.join(commentsDir, file));
                        comments.push(comment);
                    } catch (err) {
                        logger.warn(`Error reading comment file ${file}:`, err.message);
                    }
                }
            }
        }
        
        // Sort by date descending
        comments.sort((a, b) => new Date(b.SubmittedDate) - new Date(a.SubmittedDate));
        
        res.json({ success: true, comments });
    } catch (error) {
        logger.error('Get comments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Ping host
 */
router.get('/ping', async (req, res) => {
    try {
        const { host } = req.query;
        
        if (!host) {
            return res.status(400).json({ success: false, error: 'Host required' });
        }
        
        // Use Node.js ping functionality
        const ping = require('ping');
        const result = await ping.promise.probe(host, {
            timeout: 3,
            min_reply: 1
        });
        
        res.json({ 
            success: result.alive, 
            host: result.host,
            time: result.time,
            message: result.alive ? 'Host is reachable' : 'Host is not reachable'
        });
    } catch (error) {
        logger.error('Ping error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

