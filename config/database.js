/**
 * Database Configuration
 * Supports SQL Server with SQLite fallback
 * Automatically falls back to SQLite if SQL Server is unavailable
 */

const sql = require('mssql');
const Database = require('better-sqlite3');
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
        enableArithAbort: true,
        connectTimeout: 5000,
        requestTimeout: 5000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let sqlServerPool = null;
let useSQLite = false;
let sqliteDb = null;

// SQLite Configuration
const sqliteDbPath = path.join(__dirname, '../data/sefer_maarexet.db');

/**
 * Initialize SQLite database
 */
function initializeSQLite() {
    try {
        const dbDir = path.dirname(sqliteDbPath);
        fs.ensureDirSync(dbDir);
        
        sqliteDb = new Database(sqliteDbPath);
        sqliteDb.pragma('journal_mode = WAL');
        sqliteDb.pragma('foreign_keys = ON');
        
        // Create tables if they don't exist
        sqliteDb.exec(`
            CREATE TABLE IF NOT EXISTS CI (
                Name TEXT PRIMARY KEY,
                CI_ID TEXT UNIQUE NOT NULL,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS DATABOX (
                name TEXT PRIMARY KEY,
                f0 TEXT, f1 TEXT, f2 TEXT, f3 TEXT, f4 TEXT, f5 TEXT, f6 TEXT, f7 TEXT, f8 TEXT, f9 TEXT,
                f10 TEXT, f11 TEXT, f12 TEXT, f13 TEXT, f14 TEXT, f15 TEXT, f16 TEXT, f17 TEXT, f18 TEXT, f19 TEXT,
                f20 TEXT, f21 TEXT, f22 TEXT, f23 TEXT, f24 TEXT, f25 TEXT, f26 TEXT, f27 TEXT, f28 TEXT, f29 TEXT,
                f30 TEXT, f31 TEXT, f32 TEXT, f33 TEXT, f34 TEXT, f35 TEXT, f36 TEXT, f37 TEXT, f38 TEXT, f39 TEXT,
                f40 TEXT, f41 TEXT, f42 TEXT, f43 TEXT, f44 TEXT, f45 TEXT, f46 TEXT, f47 TEXT, f48 TEXT, f49 TEXT, f50 TEXT,
                FOREIGN KEY (name) REFERENCES CI(CI_ID)
            );
            
            CREATE INDEX IF NOT EXISTS idx_CI_Name ON CI(Name);
            CREATE INDEX IF NOT EXISTS idx_CI_CI_ID ON CI(CI_ID);
            CREATE INDEX IF NOT EXISTS idx_DATABOX_name ON DATABOX(name);
        `);
        
        logger.info('SQLite database initialized successfully');
        return true;
    } catch (error) {
        logger.error('Error initializing SQLite:', error);
        return false;
    }
}

/**
 * Test SQL Server connection
 */
async function testSQLServerConnection() {
    try {
        if (!sqlServerConfig.user || !sqlServerConfig.password) {
            logger.warn('SQL Server credentials not configured, using SQLite');
            return false;
        }
        
        const testPool = await sql.connect(sqlServerConfig);
        await testPool.request().query('SELECT 1');
        await testPool.close();
        return true;
    } catch (error) {
        logger.warn('SQL Server connection test failed:', error.message);
        return false;
    }
}

/**
 * Initialize database connection
 */
async function initializeDatabase() {
    // Try SQL Server first
    const sqlServerAvailable = await testSQLServerConnection();
    
    if (sqlServerAvailable) {
        try {
            sqlServerPool = await sql.connect(sqlServerConfig);
            logger.info('SQL Server connection established');
            useSQLite = false;
            return { type: 'sqlserver', connected: true };
        } catch (error) {
            logger.warn('Failed to connect to SQL Server, falling back to SQLite:', error.message);
        }
    } else {
        logger.warn('SQL Server not available, using SQLite');
    }
    
    // Fallback to SQLite
    const sqliteInitialized = initializeSQLite();
    if (sqliteInitialized) {
        useSQLite = true;
        logger.info('Using SQLite as primary database');
        return { type: 'sqlite', connected: true };
    }
    
    logger.error('Failed to initialize any database');
    return { type: 'none', connected: false };
}

/**
 * Get SQL Server connection pool
 */
async function getSqlServerPool() {
    if (useSQLite) {
        throw new Error('SQL Server not available, using SQLite');
    }
    
    if (!sqlServerPool) {
        sqlServerPool = await sql.connect(sqlServerConfig);
    }
    return sqlServerPool;
}

/**
 * Convert SQL Server query to SQLite format
 */
function convertQueryToSQLite(query, params) {
    let sqliteQuery = query;
    const sqliteParams = [];
    
    // Replace SQL Server parameter syntax (@param) with SQLite (?)
    const paramKeys = Object.keys(params || {});
    paramKeys.forEach((key, index) => {
        const regex = new RegExp(`@${key}\\b`, 'g');
        sqliteQuery = sqliteQuery.replace(regex, '?');
        sqliteParams.push(params[key]);
    });
    
        // Replace SQL Server specific syntax
        sqliteQuery = sqliteQuery.replace(/GETDATE\(\)/gi, "datetime('now')");
        sqliteQuery = sqliteQuery.replace(/TOP\s+(\d+)/gi, '');
        // Move LIMIT to end if it exists in query
        if (sqliteQuery.includes('LIMIT')) {
            // Already has LIMIT, keep it
        } else if (sqliteQuery.match(/SELECT.*LIMIT/i)) {
            // LIMIT already in query
        }
        sqliteQuery = sqliteQuery.replace(/ISNULL\(([^,]+),\s*([^)]+)\)/gi, 'COALESCE($1, $2)');
    
    return { query: sqliteQuery, params: sqliteParams };
}

/**
 * Execute query (automatically uses SQLite if SQL Server unavailable)
 */
async function executeQuery(query, params = {}) {
    if (useSQLite) {
        return executeSQLiteQuery(query, params);
    }
    
    try {
        const pool = await getSqlServerPool();
        const request = pool.request();
        
        // Add parameters
        Object.keys(params).forEach(key => {
            request.input(key, params[key]);
        });
        
        const result = await request.query(query);
        return result.recordset;
    } catch (error) {
        logger.warn('SQL Server query failed, falling back to SQLite:', error.message);
        
        // Fallback to SQLite
        if (!useSQLite) {
            const sqliteInitialized = initializeSQLite();
            if (sqliteInitialized) {
                useSQLite = true;
                return executeSQLiteQuery(query, params);
            }
        }
        
        throw error;
    }
}

/**
 * Execute SQLite query
 */
function executeSQLiteQuery(query, params = {}) {
    if (!sqliteDb) {
        if (!initializeSQLite()) {
            throw new Error('SQLite database not available');
        }
    }
    
    try {
        const { query: sqliteQuery, params: sqliteParams } = convertQueryToSQLite(query, params);
        
        // Handle array params (for INSERT with multiple values)
        if (Array.isArray(params)) {
            const stmt = sqliteDb.prepare(sqliteQuery);
            const result = stmt.all(...params);
            return result;
        }
        
        const stmt = sqliteDb.prepare(sqliteQuery);
        const result = stmt.all(...sqliteParams);
        return result;
    } catch (error) {
        logger.error('SQLite query error:', error);
        throw error;
    }
}

/**
 * Execute SQLite query (insert/update/delete)
 */
function executeSQLiteWrite(query, params = {}) {
    if (!sqliteDb) {
        if (!initializeSQLite()) {
            throw new Error('SQLite database not available');
        }
    }
    
    try {
        const { query: sqliteQuery, params: sqliteParams } = convertQueryToSQLite(query, params);
        
        // Handle array params
        if (Array.isArray(params)) {
            const stmt = sqliteDb.prepare(sqliteQuery);
            const result = stmt.run(...params);
            return result;
        }
        
        const stmt = sqliteDb.prepare(sqliteQuery);
        const result = stmt.run(...sqliteParams);
        return result;
    } catch (error) {
        logger.error('SQLite write error:', error);
        throw error;
    }
}

/**
 * Get database type
 */
function getDatabaseType() {
    return useSQLite ? 'sqlite' : 'sqlserver';
}

/**
 * Check if using SQLite
 */
function isUsingSQLite() {
    return useSQLite;
}

/**
 * Check if database is connected
 */
function isConnected() {
    if (useSQLite) {
        return sqliteDb !== null;
    }
    return sqlServerPool !== null;
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
            sqliteDb.close();
            logger.info('SQLite connection closed');
        }
    } catch (error) {
        logger.error('Error closing connections:', error);
    }
}

// Initialize on load
initializeDatabase().catch(err => {
    logger.error('Database initialization error:', err);
});

module.exports = {
    initializeDatabase,
    executeQuery,
    executeSQLiteQuery,
    executeSQLiteWrite,
    getDatabaseType,
    isConnected,
    closeConnections,
    getSqlServerPool,
    isUsingSQLite
};

