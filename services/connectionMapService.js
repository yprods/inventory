/**
 * Connection Map Service
 * Maps relationships and connections between items
 */

const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create connection between two items
 */
async function createConnection(sourceItem, targetItem, connectionType, metadata = {}) {
    try {
        const connectionId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        
        await executeSqliteQuery(`
            INSERT INTO ItemConnections 
            (Id, SourceItem, TargetItem, ConnectionType, Metadata, CreatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            connectionId,
            sourceItem,
            targetItem,
            connectionType || 'related',
            JSON.stringify(metadata),
            new Date().toISOString()
        ]);
        
        logger.info(`Connection created: ${sourceItem} -> ${targetItem} (${connectionType})`);
        return { id: connectionId, sourceItem, targetItem, connectionType, metadata };
    } catch (error) {
        logger.error('Error creating connection:', error);
        throw error;
    }
}

/**
 * Get all connections for an item
 */
async function getItemConnections(itemName) {
    try {
        const connections = await executeSqliteQuery(`
            SELECT * FROM ItemConnections 
            WHERE SourceItem = ? OR TargetItem = ?
            ORDER BY CreatedAt DESC
        `, [itemName, itemName]);
        
        return connections.map(conn => ({
            ...conn,
            Metadata: conn.Metadata ? JSON.parse(conn.Metadata) : {},
            isOutgoing: conn.SourceItem === itemName,
            isIncoming: conn.TargetItem === itemName,
            otherItem: conn.SourceItem === itemName ? conn.TargetItem : conn.SourceItem
        }));
    } catch (error) {
        logger.error('Error getting item connections:', error);
        return [];
    }
}

/**
 * Get full connection map (all connections)
 */
async function getFullConnectionMap() {
    try {
        const connections = await executeSqliteQuery(`
            SELECT * FROM ItemConnections 
            ORDER BY CreatedAt DESC
        `);
        
        const nodes = new Set();
        const edges = connections.map(conn => {
            nodes.add(conn.SourceItem);
            nodes.add(conn.TargetItem);
            return {
                id: conn.Id,
                source: conn.SourceItem,
                target: conn.TargetItem,
                type: conn.ConnectionType,
                metadata: conn.Metadata ? JSON.parse(conn.Metadata) : {},
                createdAt: conn.CreatedAt
            };
        });
        
        return {
            nodes: Array.from(nodes).map(name => ({ id: name, name: name })),
            edges: edges
        };
    } catch (error) {
        logger.error('Error getting full connection map:', error);
        return { nodes: [], edges: [] };
    }
}

/**
 * Get connection path between two items
 */
async function getConnectionPath(sourceItem, targetItem, maxDepth = 5) {
    try {
        const visited = new Set();
        const queue = [{ item: sourceItem, path: [sourceItem], depth: 0 }];
        
        while (queue.length > 0) {
            const { item, path, depth } = queue.shift();
            
            if (depth > maxDepth) continue;
            if (visited.has(item)) continue;
            visited.add(item);
            
            if (item === targetItem) {
                return path;
            }
            
            const connections = await executeSqliteQuery(`
                SELECT SourceItem, TargetItem FROM ItemConnections 
                WHERE SourceItem = ? OR TargetItem = ?
            `, [item, item]);
            
            for (const conn of connections) {
                const nextItem = conn.SourceItem === item ? conn.TargetItem : conn.SourceItem;
                if (!visited.has(nextItem)) {
                    queue.push({ item: nextItem, path: [...path, nextItem], depth: depth + 1 });
                }
            }
        }
        
        return null; // No path found
    } catch (error) {
        logger.error('Error finding connection path:', error);
        return null;
    }
}

/**
 * Get related items (items connected to this one)
 */
async function getRelatedItems(itemName, limit = 20) {
    try {
        const connections = await getItemConnections(itemName);
        const relatedItems = new Set();
        
        connections.forEach(conn => {
            if (conn.SourceItem === itemName) {
                relatedItems.add(conn.TargetItem);
            } else {
                relatedItems.add(conn.SourceItem);
            }
        });
        
        return Array.from(relatedItems).slice(0, limit);
    } catch (error) {
        logger.error('Error getting related items:', error);
        return [];
    }
}

/**
 * Auto-detect connections based on field values
 */
async function autoDetectConnections(itemName) {
    try {
        // Get item data
        const itemData = await executeQuery(`
            SELECT * FROM DATABOX WHERE name = @name
        `, { name: itemName });
        
        if (!itemData || itemData.length === 0) return [];
        
        const data = itemData[0];
        const detectedConnections = [];
        
        // Check all fields for potential connections
        for (let i = 0; i <= 50; i++) {
            const fieldValue = data[`f${i}`];
            if (fieldValue && typeof fieldValue === 'string') {
                // Check if field value matches another item name
                const matchingItems = await executeQuery(`
                    SELECT name FROM DATABOX WHERE name = @value
                `, { value: fieldValue });
                
                if (matchingItems && matchingItems.length > 0) {
                    // Create connection
                    await createConnection(itemName, fieldValue, 'field-reference', {
                        field: `f${i}`,
                        autoDetected: true
                    });
                    detectedConnections.push(fieldValue);
                }
            }
        }
        
        logger.info(`Auto-detected ${detectedConnections.length} connections for ${itemName}`);
        return detectedConnections;
    } catch (error) {
        logger.error('Error auto-detecting connections:', error);
        return [];
    }
}

/**
 * Initialize connection tables
 */
async function initializeConnectionTables() {
    try {
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS ItemConnections (
                Id TEXT PRIMARY KEY,
                SourceItem TEXT NOT NULL,
                TargetItem TEXT NOT NULL,
                ConnectionType TEXT DEFAULT 'related',
                Metadata TEXT,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (SourceItem) REFERENCES NetworkItems(Name) ON DELETE CASCADE,
                FOREIGN KEY (TargetItem) REFERENCES NetworkItems(Name) ON DELETE CASCADE
            )
        `);
        
        await executeSqliteQuery(`
            CREATE INDEX IF NOT EXISTS idx_ItemConnections_Source 
            ON ItemConnections(SourceItem)
        `);
        
        await executeSqliteQuery(`
            CREATE INDEX IF NOT EXISTS idx_ItemConnections_Target 
            ON ItemConnections(TargetItem)
        `);
        
        logger.info('Connection map tables initialized');
    } catch (error) {
        logger.error('Error initializing connection tables:', error);
    }
}

// Initialize on load
initializeConnectionTables();

module.exports = {
    createConnection,
    getItemConnections,
    getFullConnectionMap,
    getConnectionPath,
    getRelatedItems,
    autoDetectConnections
};

