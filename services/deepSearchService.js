/**
 * Deep Search Service
 * Searches across all tables and fields
 */

const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Deep search across all tables
 */
async function deepSearch(searchTerm, options = {}) {
    try {
        const {
            limit = 100,
            tables = ['all'],
            fields = ['all'],
            exactMatch = false,
            caseSensitive = false
        } = options;
        
        const results = {
            items: [],
            connections: [],
            attachments: [],
            total: 0
        };
        
        const searchPattern = exactMatch 
            ? searchTerm 
            : `%${searchTerm}%`;
        
        // Search in CI table
        if (tables.includes('all') || tables.includes('CI')) {
            const ciResults = await executeQuery(`
                SELECT TOP ${limit} CI.*, DATABOX.*
                FROM CI
                LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
                WHERE CI.Name LIKE @search 
                   OR CI.CI_ID LIKE @search
                ORDER BY CI.CreatedAt DESC
            `, { search: searchPattern });
            
            ciResults.forEach(item => {
                results.items.push({
                    type: 'CI',
                    name: item.Name || item.name,
                    ciId: item.CI_ID,
                    data: item,
                    matchFields: findMatchingFields(item, searchTerm, caseSensitive)
                });
            });
        }
        
        // Search in DATABOX fields
        if (tables.includes('all') || tables.includes('DATABOX')) {
            const databoxResults = await executeQuery(`
                SELECT TOP ${limit} *
                FROM DATABOX
                WHERE name LIKE @search
            `, { search: searchPattern });
            
            databoxResults.forEach(item => {
                const matchFields = findMatchingFields(item, searchTerm, caseSensitive);
                if (matchFields.length > 0 || item.name.includes(searchTerm)) {
                    results.items.push({
                        type: 'DATABOX',
                        name: item.name,
                        data: item,
                        matchFields: matchFields
                    });
                }
            });
        }
        
        // Search in NetworkItems (SQLite)
        try {
            const networkItems = await executeSqliteQuery(`
                SELECT * FROM NetworkItems 
                WHERE Name LIKE ? 
                   OR ItemType LIKE ?
                LIMIT ?
            `, [searchPattern, searchPattern, limit]);
            
            networkItems.forEach(item => {
                const matchFields = findMatchingFields(item, searchTerm, caseSensitive);
                results.items.push({
                    type: 'NetworkItem',
                    name: item.Name,
                    itemType: item.ItemType,
                    data: item,
                    matchFields: matchFields
                });
            });
        } catch (err) {
            logger.warn('NetworkItems search failed:', err.message);
        }
        
        // Search in connections
        try {
            const connections = await executeSqliteQuery(`
                SELECT * FROM ItemConnections 
                WHERE SourceItem LIKE ? 
                   OR TargetItem LIKE ?
                   OR ConnectionType LIKE ?
                   OR Metadata LIKE ?
                LIMIT ?
            `, [searchPattern, searchPattern, searchPattern, searchPattern, limit]);
            
            results.connections = connections.map(conn => ({
                ...conn,
                Metadata: conn.Metadata ? JSON.parse(conn.Metadata) : {}
            }));
        } catch (err) {
            logger.warn('Connections search failed:', err.message);
        }
        
        // Search in attachments
        try {
            const attachments = await executeSqliteQuery(`
                SELECT * FROM FileAttachments 
                WHERE ItemName LIKE ? 
                   OR OriginalName LIKE ?
                   OR UploadedBy LIKE ?
                LIMIT ?
            `, [searchPattern, searchPattern, searchPattern, limit]);
            
            results.attachments = attachments;
        } catch (err) {
            logger.warn('Attachments search failed:', err.message);
        }
        
        results.total = results.items.length + results.connections.length + results.attachments.length;
        
        return results;
    } catch (error) {
        logger.error('Deep search error:', error);
        throw error;
    }
}

/**
 * Find matching fields in an object
 */
function findMatchingFields(obj, searchTerm, caseSensitive = false) {
    const matches = [];
    const search = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'string') {
            const val = caseSensitive ? value : value.toLowerCase();
            if (val.includes(search)) {
                matches.push({
                    field: key,
                    value: value,
                    matchIndex: val.indexOf(search)
                });
            }
        }
    }
    
    return matches;
}

/**
 * Search in specific field
 */
async function searchInField(tableName, fieldName, searchTerm) {
    try {
        const searchPattern = `%${searchTerm}%`;
        
        if (tableName === 'DATABOX') {
            return await executeQuery(`
                SELECT * FROM DATABOX 
                WHERE ${fieldName} LIKE @search
            `, { search: searchPattern });
        } else if (tableName === 'CI') {
            return await executeQuery(`
                SELECT * FROM CI 
                WHERE ${fieldName} LIKE @search
            `, { search: searchPattern });
        }
        
        return [];
    } catch (error) {
        logger.error('Field search error:', error);
        return [];
    }
}

/**
 * Get search suggestions
 */
async function getSearchSuggestions(partialTerm, limit = 10) {
    try {
        const suggestions = new Set();
        const pattern = `%${partialTerm}%`;
        
        // Get suggestions from CI names
        const ciNames = await executeQuery(`
            SELECT TOP ${limit} DISTINCT Name 
            FROM CI 
            WHERE Name LIKE @pattern
        `, { pattern: pattern });
        
        ciNames.forEach(item => suggestions.add(item.Name));
        
        // Get suggestions from DATABOX
        const databoxNames = await executeQuery(`
            SELECT TOP ${limit} DISTINCT name 
            FROM DATABOX 
            WHERE name LIKE @pattern
        `, { pattern: pattern });
        
        databoxNames.forEach(item => suggestions.add(item.name));
        
        return Array.from(suggestions).slice(0, limit);
    } catch (error) {
        logger.error('Get suggestions error:', error);
        return [];
    }
}

module.exports = {
    deepSearch,
    searchInField,
    getSearchSuggestions,
    findMatchingFields
};

