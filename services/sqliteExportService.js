/**
 * SQLite Export Service
 * Handles export to SQLite and local mode
 */

const { executeQuery, executeSqliteQuery, getSqliteDb } = require('../config/database');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

const LOCAL_DB_PATH = path.join(__dirname, '../data/local.db');
const MODE_FILE = path.join(__dirname, '../data/mode.json');

/**
 * Get SQLite database path
 */
function getSQLitePath() {
    return LOCAL_DB_PATH;
}

/**
 * Initialize local SQLite database
 */
async function initializeLocalDB() {
    try {
        await fs.ensureDir(path.dirname(LOCAL_DB_PATH));
        
        const db = await getSqliteDb();
        
        // Create CI table
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS CI_Local (
                Name TEXT PRIMARY KEY,
                CI_ID TEXT UNIQUE,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create DATABOX table
        const databoxFields = [];
        for (let i = 0; i <= 50; i++) {
            databoxFields.push(`f${i} TEXT`);
        }
        
        await executeSqliteQuery(`
            CREATE TABLE IF NOT EXISTS DATABOX_Local (
                name TEXT PRIMARY KEY,
                ${databoxFields.join(', ')}
            )
        `);
        
        logger.info('Local SQLite database initialized');
    } catch (error) {
        logger.error('Error initializing local DB:', error);
        throw error;
    }
}

/**
 * Export data to SQLite
 */
async function exportToSQLite() {
    try {
        await initializeLocalDB();
        
        // Get all data from SQL Server
        const ciData = await executeQuery('SELECT * FROM CI');
        const databoxData = await executeQuery('SELECT * FROM DATABOX');
        
        let count = 0;
        
        // Export CI
        for (const ci of ciData) {
            try {
                await executeSqliteQuery(`
                    INSERT OR REPLACE INTO CI_Local (Name, CI_ID, CreatedAt)
                    VALUES (?, ?, ?)
                `, [ci.Name, ci.CI_ID, ci.CreatedAt]);
                count++;
            } catch (err) {
                logger.warn(`Error exporting CI ${ci.Name}:`, err.message);
            }
        }
        
        // Export DATABOX
        for (const item of databoxData) {
            try {
                const fieldNames = [];
                const fieldValues = [];
                const placeholders = [];
                
                fieldNames.push('name');
                fieldValues.push(item.name);
                placeholders.push('?');
                
                for (let i = 0; i <= 50; i++) {
                    fieldNames.push(`f${i}`);
                    fieldValues.push(item[`f${i}`] || null);
                    placeholders.push('?');
                }
                
                await executeSqliteQuery(`
                    INSERT OR REPLACE INTO DATABOX_Local (${fieldNames.join(', ')})
                    VALUES (${placeholders.join(', ')})
                `, fieldValues);
                count++;
            } catch (err) {
                logger.warn(`Error exporting DATABOX ${item.name}:`, err.message);
            }
        }
        
        logger.info(`Exported ${count} records to SQLite`);
        return { count };
    } catch (error) {
        logger.error('Export to SQLite error:', error);
        throw error;
    }
}

/**
 * Sync data to SQLite (incremental)
 */
async function syncToSQLite() {
    try {
        await initializeLocalDB();
        
        // Get last sync time
        let lastSync = null;
        try {
            const modeData = await fs.readJson(MODE_FILE);
            lastSync = modeData.lastSync;
        } catch (err) {
            // First sync
        }
        
        let query = 'SELECT * FROM CI';
        const params = {};
        
        if (lastSync) {
            query += ' WHERE CreatedAt > @lastSync';
            params.lastSync = lastSync;
        }
        
        const ciData = await executeQuery(query, params);
        const databoxData = await executeQuery('SELECT * FROM DATABOX', {});
        
        let count = 0;
        
        // Sync CI
        for (const ci of ciData) {
            try {
                await executeSqliteQuery(`
                    INSERT OR REPLACE INTO CI_Local (Name, CI_ID, CreatedAt)
                    VALUES (?, ?, ?)
                `, [ci.Name, ci.CI_ID, ci.CreatedAt]);
                count++;
            } catch (err) {
                logger.warn(`Error syncing CI ${ci.Name}:`, err.message);
            }
        }
        
        // Sync DATABOX
        for (const item of databoxData) {
            try {
                const fieldNames = ['name'];
                const fieldValues = [item.name];
                const placeholders = ['?'];
                
                for (let i = 0; i <= 50; i++) {
                    fieldNames.push(`f${i}`);
                    fieldValues.push(item[`f${i}`] || null);
                    placeholders.push('?');
                }
                
                await executeSqliteQuery(`
                    INSERT OR REPLACE INTO DATABOX_Local (${fieldNames.join(', ')})
                    VALUES (${placeholders.join(', ')})
                `, fieldValues);
                count++;
            } catch (err) {
                logger.warn(`Error syncing DATABOX ${item.name}:`, err.message);
            }
        }
        
        // Update last sync time
        await fs.writeJson(MODE_FILE, {
            mode: 'local',
            lastSync: new Date().toISOString()
        }, { spaces: 2 });
        
        logger.info(`Synced ${count} records to SQLite`);
        return { count };
    } catch (error) {
        logger.error('Sync to SQLite error:', error);
        throw error;
    }
}

/**
 * Enable local mode
 */
async function enableLocalMode() {
    try {
        await exportToSQLite();
        
        await fs.writeJson(MODE_FILE, {
            mode: 'local',
            enabledAt: new Date().toISOString(),
            lastSync: new Date().toISOString()
        }, { spaces: 2 });
        
        logger.info('Local mode enabled');
    } catch (error) {
        logger.error('Enable local mode error:', error);
        throw error;
    }
}

/**
 * Check if local mode is enabled
 */
async function isLocalMode() {
    try {
        if (await fs.pathExists(MODE_FILE)) {
            const modeData = await fs.readJson(MODE_FILE);
            return modeData.mode === 'local';
        }
        return false;
    } catch (error) {
        return false;
    }
}

module.exports = {
    exportToSQLite,
    syncToSQLite,
    enableLocalMode,
    isLocalMode,
    getSQLitePath,
    initializeLocalDB
};

