const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

router.get('/files/list', async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, '../uploads');
        await fs.ensureDir(uploadsDir);
        
        const files = [];
        try {
            const fileList = await fs.readdir(uploadsDir, { withFileTypes: true });
            for (const file of fileList) {
                if (file.isFile()) {
                    const filePath = path.join(uploadsDir, file.name);
                    const stats = await fs.stat(filePath);
                    files.push({
                        name: file.name,
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
        } catch (err) {
            logger.warn('Error reading files directory:', err.message);
        }
        
        res.render('files/list', {
            title: 'ניהול קבצים',
            files: files,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Files page error:', error);
        res.render('files/list', {
            title: 'ניהול קבצים',
            files: [],
            error: 'שגיאה בטעינת הקבצים',
            user: req.user || { name: 'Guest' }
        });
    }
});

module.exports = router;
