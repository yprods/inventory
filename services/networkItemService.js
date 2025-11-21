/**
 * Network Item Service
 * Manages network items in SQLite database
 */

const { executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Initialize database tables
 */
async function initializeDatabase() {
    try {
        // Tables are created automatically by database.js
        logger.info('NetworkItemService initialized');
    } catch (error) {
        logger.error('NetworkItemService initialization error:', error);
    }
}

/**
 * Find network item by name
 */
async function findNetworkItem(name) {
    try {
        const query = 'SELECT * FROM NetworkItems WHERE Name = ? LIMIT 1';
        const results = await executeSqliteQuery(query, [name]);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        logger.error('Find network item error:', error);
        return null;
    }
}

/**
 * Create network item
 */
async function createNetworkItem(name, itemType, createdBy, fieldValues = null) {
    try {
        await initializeDatabase();
        
        // Build field names and values
        const fieldNames = [];
        const fieldParams = [];
        const values = [name, itemType || 'Unknown', createdBy || 'System'];
        
        for (let i = 0; i <= 50; i++) {
            fieldNames.push(`f${i}`);
            fieldParams.push('?');
            values.push((fieldValues && fieldValues[i]) ? fieldValues[i] : null);
        }
        
        const query = `
            INSERT INTO NetworkItems (Name, ItemType, CreatedBy, UpdatedAt, ${fieldNames.join(', ')})
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, ${fieldParams.join(', ')})
        `;
        
        await executeSqliteQuery(query, values);
        logger.info(`Network item created: ${name}`);
        return true;
    } catch (error) {
        logger.error('Create network item error:', error);
        return false;
    }
}

/**
 * Add relation
 */
async function addRelation(networkItemId, relatedTable, relatedId, relationType = null) {
    try {
        const query = `
            INSERT INTO NetworkItemRelations (NetworkItemId, RelatedTable, RelatedId, RelationType)
            VALUES (?, ?, ?, ?)
        `;
        
        await executeSqliteQuery(query, [networkItemId, relatedTable, relatedId, relationType || 'related']);
        return true;
    } catch (error) {
        logger.error('Add relation error:', error);
        return false;
    }
}

module.exports = {
    initializeDatabase,
    findNetworkItem,
    createNetworkItem,
    addRelation
};

