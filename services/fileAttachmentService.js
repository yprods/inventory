/**
 * File Attachment Service
 * Manages file attachments for items and chat
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

const ATTACHMENTS_DIR = path.join(__dirname, '../uploads/attachments');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Initialize attachments directory
 */
async function initializeAttachments() {
    await fs.ensureDir(ATTACHMENTS_DIR);
    await fs.ensureDir(path.join(ATTACHMENTS_DIR, 'items'));
    await fs.ensureDir(path.join(ATTACHMENTS_DIR, 'chat'));
    await fs.ensureDir(path.join(ATTACHMENTS_DIR, 'temp'));
}

/**
 * Attach file to an item
 */
async function attachFileToItem(itemName, fileInfo, uploadedBy) {
    try {
        await initializeAttachments();
        
        const attachmentId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        const itemDir = path.join(ATTACHMENTS_DIR, 'items', itemName);
        await fs.ensureDir(itemDir);
        
        const attachmentPath = path.join(itemDir, fileInfo.filename);
        await fs.move(fileInfo.path, attachmentPath);
        
        // Save attachment metadata to database
        const metadata = {
            id: attachmentId,
            itemName: itemName,
            originalName: fileInfo.originalname,
            filename: fileInfo.filename,
            path: attachmentPath,
            size: fileInfo.size,
            mimeType: fileInfo.mimetype,
            uploadedBy: uploadedBy,
            uploadedAt: new Date().toISOString()
        };
        
        // Save to SQLite
        await executeSqliteQuery(`
            INSERT INTO FileAttachments 
            (Id, ItemName, OriginalName, Filename, Path, Size, MimeType, UploadedBy, UploadedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            metadata.id,
            metadata.itemName,
            metadata.originalName,
            metadata.filename,
            metadata.path,
            metadata.size,
            metadata.mimeType,
            metadata.uploadedBy,
            metadata.uploadedAt
        ]);
        
        logger.info(`File attached to item: ${itemName}`, metadata);
        return metadata;
    } catch (error) {
        logger.error('Error attaching file to item:', error);
        throw error;
    }
}

/**
 * Get attachments for an item
 */
async function getItemAttachments(itemName) {
    try {
        const attachments = await executeSqliteQuery(`
            SELECT * FROM FileAttachments 
            WHERE ItemName = ? 
            ORDER BY UploadedAt DESC
        `, [itemName]);
        
        return attachments.map(att => ({
            ...att,
            url: `/api/attachments/download/${att.Id}`
        }));
    } catch (error) {
        logger.error('Error getting item attachments:', error);
        return [];
    }
}

/**
 * Attach file to chat message
 */
async function attachFileToChat(messageId, fileInfo, uploadedBy) {
    try {
        await initializeAttachments();
        
        const chatDir = path.join(ATTACHMENTS_DIR, 'chat');
        await fs.ensureDir(chatDir);
        
        const attachmentPath = path.join(chatDir, fileInfo.filename);
        await fs.move(fileInfo.path, attachmentPath);
        
        const metadata = {
            messageId: messageId,
            originalName: fileInfo.originalname,
            filename: fileInfo.filename,
            url: `/api/attachments/chat/${fileInfo.filename}`,
            size: fileInfo.size,
            mimeType: fileInfo.mimetype,
            uploadedBy: uploadedBy
        };
        
        return metadata;
    } catch (error) {
        logger.error('Error attaching file to chat:', error);
        throw error;
    }
}

/**
 * Delete attachment
 */
async function deleteAttachment(attachmentId) {
    try {
        const attachment = await executeSqliteQuery(`
            SELECT * FROM FileAttachments WHERE Id = ?
        `, [attachmentId]);
        
        if (attachment.length === 0) {
            throw new Error('Attachment not found');
        }
        
        const att = attachment[0];
        if (await fs.pathExists(att.Path)) {
            await fs.remove(att.Path);
        }
        
        await executeSqliteQuery(`
            DELETE FROM FileAttachments WHERE Id = ?
        `, [attachmentId]);
        
        logger.info(`Attachment deleted: ${attachmentId}`);
        return true;
    } catch (error) {
        logger.error('Error deleting attachment:', error);
        throw error;
    }
}

/**
 * Initialize database tables for attachments
 */
async function initializeAttachmentTables() {
    try {
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS FileAttachments (
                Id TEXT PRIMARY KEY,
                ItemName TEXT NOT NULL,
                OriginalName TEXT NOT NULL,
                Filename TEXT NOT NULL,
                Path TEXT NOT NULL,
                Size INTEGER NOT NULL,
                MimeType TEXT,
                UploadedBy TEXT,
                UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ItemName) REFERENCES NetworkItems(Name) ON DELETE CASCADE
            )
        `);
        
        await executeSqliteQuery(`
            CREATE INDEX IF NOT EXISTS idx_FileAttachments_ItemName 
            ON FileAttachments(ItemName)
        `);
        
        logger.info('File attachment tables initialized');
    } catch (error) {
        logger.error('Error initializing attachment tables:', error);
    }
}

// Initialize on load
initializeAttachmentTables();

module.exports = {
    attachFileToItem,
    getItemAttachments,
    attachFileToChat,
    deleteAttachment,
    initializeAttachments,
    MAX_FILE_SIZE
};

