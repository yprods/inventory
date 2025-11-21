/**
 * Sefer Maarexet - Main Server File
 * Modern Node.js/Express Implementation with SQLite Fallback
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Import routes
const homeRoutes = require('./routes/home');
const chatRoutes = require('./routes/chat');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');
const connectionsRoutes = require('./routes/connections');
const deepSearchRoutes = require('./routes/deepsearch');
const alertsRoutes = require('./routes/alerts');
const printersRoutes = require('./routes/printers');
const computersRoutes = require('./routes/computers');
const appstoreRoutes = require('./routes/appstore');
const phonebookRoutes = require('./routes/phonebook');
const suppliersRoutes = require('./routes/suppliers');
const importRoutes = require('./routes/import');
const auditRoutes = require('./routes/audit').router;
const permissionsRoutes = require('./routes/permissions');

// Import middleware
const { authenticateUser } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
    }
});

// Port configuration
const PORT = process.env.PORT || 1212;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for EJS
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors());

// Body parsing
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'sefer-maarexet-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io available to routes
app.set('io', io);

// Make user available to all views via res.locals
app.use((req, res, next) => {
    if (req.session && req.session.user) {
        res.locals.user = req.session.user;
    } else if (req.session && req.session.pinAuthenticated) {
        res.locals.user = {
            name: req.session.userName || 'Guest',
            isPinAuthenticated: true
        };
    }
    next();
});

// ============================================================================
// ROUTES
// ============================================================================

// Public routes (must be before protected routes)
app.use('/auth', authRoutes);

// API routes (before authentication)
app.use('/api', apiRoutes);

// Protected routes (require authentication)
app.use('/', authenticateUser, homeRoutes);
app.use('/', authenticateUser, chatRoutes);
app.use('/', authenticateUser, searchRoutes);
app.use('/', authenticateUser, fileRoutes);
app.use('/', authenticateUser, connectionsRoutes);
app.use('/', authenticateUser, deepSearchRoutes);
app.use('/', authenticateUser, alertsRoutes);
app.use('/', authenticateUser, printersRoutes);
app.use('/', authenticateUser, computersRoutes);
app.use('/', authenticateUser, appstoreRoutes);
app.use('/', authenticateUser, phonebookRoutes);
app.use('/', authenticateUser, suppliersRoutes);
app.use('/', authenticateUser, importRoutes);
app.use('/', authenticateUser, auditRoutes);
app.use('/', permissionsRoutes);
app.use('/', adminRoutes);

// Root route - redirect to home or login (must be after all other routes)
app.get('/', (req, res) => {
    const search = req.query.search;
    if (search && search.trim()) {
        return res.redirect(`/datablocks?search=${encodeURIComponent(search.trim())}`);
    }
    
    if (req.session && (req.session.user || req.session.pinAuthenticated)) {
        return res.redirect('/home');
    }
    res.redirect('/auth/login');
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 - לא נמצא',
        message: 'הדף המבוקש לא נמצא'
    });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

io.on('connection', (socket) => {
    logger.info('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        logger.info('Client disconnected:', socket.id);
    });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Check database connection
    const { getDatabaseType, isConnected } = require('./config/database');
    logger.info(`Database: ${getDatabaseType()} (${isConnected() ? 'connected' : 'disconnected'})`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    const { closeConnections } = require('./config/database');
    await closeConnections();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    const { closeConnections } = require('./config/database');
    await closeConnections();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

module.exports = app;

