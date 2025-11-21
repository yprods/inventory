/**
 * Sefer Maarexet - Main Server File
 * Modern Node.js/Express Implementation
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
    contentSecurityPolicy: false, // Adjust based on your needs
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================================================
// ROUTES
// ============================================================================

// Public routes
app.use('/auth', authRoutes);

// Protected routes
app.use('/', authenticateUser, homeRoutes);
app.use('/chat', authenticateUser, chatRoutes);
app.use('/api', authenticateUser, apiRoutes);
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

// Root redirect
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/home');
    } else {
        res.redirect('/auth/login');
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 - Not Found',
        message: 'הדף המבוקש לא נמצא'
    });
});

// Error handler
app.use(errorHandler);

// ============================================================================
// SOCKET.IO - CHAT FUNCTIONALITY
// ============================================================================

const chatManager = require('./services/chatManager');
chatManager.initialize(io);

// ============================================================================
// SERVER STARTUP
// ============================================================================

server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n🚀 Sefer Maarexet Server Started!`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };

