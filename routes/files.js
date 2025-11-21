/**
 * File Management Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        await fs.ensureDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types (adjust as needed)
        cb(null, true);
    }
});

/**
 * File upload page
 */
router.get('/files/upload', (req, res) => {
    res.render('files/upload', {
        title: 'העלאת קבצים',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Handle file upload
 */
router.post('/files/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.render('files/upload', {
                title: 'העלאת קבצים',
                error: 'לא נבחר קובץ',
                user: req.user || { name: 'Guest' }
            });
        }
        
        req.session.successMessage = `הקובץ '${req.file.originalname}' הועלה בהצלחה!`;
        res.redirect('/files/list');
    } catch (error) {
        logger.error('File upload error:', error);
        res.render('files/upload', {
            title: 'העלאת קבצים',
            error: 'שגיאה בהעלאת הקובץ',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * List uploaded files
 */
router.get('/files/list', async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, '../uploads');
        await fs.ensureDir(uploadsDir);
        
        const files = await fs.readdir(uploadsDir);
        const fileDetails = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(uploadsDir, file);
                const stats = await fs.stat(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                    url: `/uploads/${file}`
                };
            })
        );
        
        res.render('files/list', {
            title: 'רשימת קבצים',
            files: fileDetails,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('List files error:', error);
        res.render('files/list', {
            title: 'רשימת קבצים',
            files: [],
            error: 'שגיאה בטעינת הקבצים',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Download file
 */
router.get('/files/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '../uploads', filename);
        
        if (await fs.pathExists(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).render('error', {
                title: '404',
                message: 'הקובץ לא נמצא'
            });
        }
    } catch (error) {
        logger.error('Download file error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בהורדת הקובץ'
        });
    }
});

module.exports = router;

