/**
 * Database Configuration
 * Supports both SQL Server and SQLite
 */

const sql = require('mssql');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');

// SQL Server Configuration
const sqlServerConfig = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'SeferMaarexet',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true',
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let sqlServerPool = null;

/**
 * Get SQL Server connection pool
 */
async function getSqlServerPool() {
    try {
        if (!sqlServerPool) {
            sqlServerPool = await sql.connect(sqlServerConfig);
            logger.info('SQL Server connection pool created');
        }
        return sqlServerPool;
    } catch (error) {
        logger.error('SQL Server connection error:', error);
        throw error;
    }
}

/**
 * Check if local mode is enabled
 */
async function isLocalMode() {
    try {
        const sqliteExportService = require('../services/sqliteExportService');
        return await sqliteExportService.isLocalMode();
    } catch (error) {
        return false;
    }
}

/**
 * Execute SQL Server query (or SQLite if in local mode)
 */
async function executeQuery(query, params = {}) {
    try {
        // Check if local mode is enabled
        if (await isLocalMode()) {
            // Convert SQL Server query to SQLite format
            let sqliteQuery = query;
            const sqliteParams = [];
            
            // Replace SQL Server parameter syntax (@param) with SQLite (?)
            const paramKeys = Object.keys(params);
            paramKeys.forEach((key, index) => {
                sqliteQuery = sqliteQuery.replace(new RegExp(`@${key}`, 'g'), '?');
                sqliteParams.push(params[key]);
            });
            
            // Replace SQL Server specific syntax
            sqliteQuery = sqliteQuery.replace(/GETDATE\(\)/gi, "datetime('now')");
            sqliteQuery = sqliteQuery.replace(/TOP\s+(\d+)/gi, 'LIMIT $1');
            sqliteQuery = sqliteQuery.replace(/DATABOX\./g, 'DATABOX_Local.');
            sqliteQuery = sqliteQuery.replace(/CI\./g, 'CI_Local.');
            
            return await executeSqliteQuery(sqliteQuery, sqliteParams);
        }
        
        // Use SQL Server
        const pool = await getSqlServerPool();
        const request = pool.request();
        
        // Add parameters
        Object.keys(params).forEach(key => {
            request.input(key, params[key]);
        });
        
        const result = await request.query(query);
        return result.recordset;
    } catch (error) {
        logger.error('Query execution error:', error);
        throw error;
    }
}

/**
 * Execute SQL Server stored procedure
 */
async function executeProcedure(procedureName, params = {}) {
    try {
        const pool = await getSqlServerPool();
        const request = pool.request();
        
        Object.keys(params).forEach(key => {
            request.input(key, params[key]);
        });
        
        const result = await request.execute(procedureName);
        return result.recordset;
    } catch (error) {
        logger.error('Stored procedure execution error:', error);
        throw error;
    }
}

// SQLite Configuration
const sqliteDbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/network_items.db');
let sqliteDb = null;

/**
 * Get SQLite database connection
 */
function getSqliteDb() {
    return new Promise((resolve, reject) => {
        if (sqliteDb) {
            return resolve(sqliteDb);
        }
        
        // Ensure directory exists
        const dbDir = path.dirname(sqliteDbPath);
        fs.ensureDirSync(dbDir);
        
        sqliteDb = new sqlite3.Database(sqliteDbPath, (err) => {
            if (err) {
                logger.error('SQLite connection error:', err);
                return reject(err);
            }
            logger.info('SQLite database connected');
            initializeSqliteTables();
            resolve(sqliteDb);
        });
    });
}

/**
 * Initialize SQLite tables
 */
function initializeSqliteTables() {
    const createTables = `
        CREATE TABLE IF NOT EXISTS NetworkItems (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL UNIQUE,
            ItemType TEXT,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            CreatedBy TEXT,
            f0 TEXT, f1 TEXT, f2 TEXT, f3 TEXT, f4 TEXT,
            f5 TEXT, f6 TEXT, f7 TEXT, f8 TEXT, f9 TEXT,
            f10 TEXT, f11 TEXT, f12 TEXT, f13 TEXT, f14 TEXT,
            f15 TEXT, f16 TEXT, f17 TEXT, f18 TEXT, f19 TEXT,
            f20 TEXT, f21 TEXT, f22 TEXT, f23 TEXT, f24 TEXT,
            f25 TEXT, f26 TEXT, f27 TEXT, f28 TEXT, f29 TEXT,
            f30 TEXT, f31 TEXT, f32 TEXT, f33 TEXT, f34 TEXT,
            f35 TEXT, f36 TEXT, f37 TEXT, f38 TEXT, f39 TEXT,
            f40 TEXT, f41 TEXT, f42 TEXT, f43 TEXT, f44 TEXT,
            f45 TEXT, f46 TEXT, f47 TEXT, f48 TEXT, f49 TEXT,
            f50 TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_NetworkItems_Name ON NetworkItems(Name);
        
        CREATE TABLE IF NOT EXISTS NetworkItemRelations (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            NetworkItemId INTEGER NOT NULL,
            RelatedTable TEXT NOT NULL,
            RelatedId TEXT NOT NULL,
            RelationType TEXT,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (NetworkItemId) REFERENCES NetworkItems(Id) ON DELETE CASCADE
        );
    `;
    
    sqliteDb.exec(createTables, (err) => {
        if (err) {
            logger.error('Error initializing SQLite tables:', err);
        } else {
            logger.info('SQLite tables initialized');
        }
    });
}

/**
 * Execute SQLite query
 */
function executeSqliteQuery(query, params = []) {
    return new Promise((resolve, reject) => {
        getSqliteDb().then(db => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    logger.error('SQLite query error:', err);
                    return reject(err);
                }
                resolve(rows);
            });
        }).catch(reject);
    });
}

/**
 * Close all database connections
 */
async function closeConnections() {
    try {
        if (sqlServerPool) {
            await sqlServerPool.close();
            logger.info('SQL Server connection closed');
        }
        if (sqliteDb) {
            sqliteDb.close((err) => {
                if (err) {
                    logger.error('Error closing SQLite:', err);
                } else {
                    logger.info('SQLite connection closed');
                }
            });
        }
    } catch (error) {
        logger.error('Error closing connections:', error);
    }
}

module.exports = {
    getSqlServerPool,
    executeQuery,
    executeProcedure,
    getSqliteDb,
    executeSqliteQuery,
    closeConnections,
    isLocalMode
};

