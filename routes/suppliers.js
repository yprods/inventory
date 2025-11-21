/**
 * Suppliers Routes
 */

const express = require('express');
const router = express.Router();
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Suppliers list page
 */
router.get('/suppliers', async (req, res) => {
    try {
        const { search, category, status } = req.query;
        
        let query = `
            SELECT TOP 200 
                CI.Name, CI.CI_ID, CI.CreatedAt,
                DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE (CI.Name LIKE @search OR DATABOX.f0 LIKE @search)
            AND DATABOX.f6 = 'Supplier'
        `;
        
        const params = { search: `%${search || ''}%` };
        
        if (category) {
            query += ` AND DATABOX.f1 = @category`;
            params.category = category;
        }
        if (status) {
            query += ` AND DATABOX.f2 = @status`;
            params.status = status;
        }
        
        query += ` ORDER BY CI.Name`;
        
        const suppliers = await executeQuery(query, params);
        
        // Get categories
        const categories = await executeQuery(`
            SELECT DISTINCT f1 as category
            FROM DATABOX
            WHERE f6 = 'Supplier' AND f1 IS NOT NULL
            ORDER BY f1
        `);
        
        res.render('suppliers/index', {
            title: 'ספקים',
            suppliers: suppliers || [],
            categories: categories || [],
            search: search || '',
            category: category || '',
            status: status || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Suppliers page error:', error);
        res.render('suppliers/index', {
            title: 'ספקים',
            suppliers: [],
            categories: [],
            error: 'שגיאה בטעינת הספקים',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Supplier details page
 */
router.get('/suppliers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT CI.*, DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE CI.CI_ID = @id OR CI.Name = @id
        `;
        
        const results = await executeQuery(query, { id });
        const supplier = results[0] || null;
        
        if (!supplier) {
            return res.status(404).render('error', {
                title: '404',
                message: 'ספק לא נמצא'
            });
        }
        
        // Get related orders/transactions
        let orders = [];
        try {
            const connectionService = require('../services/connectionMapService');
            const connections = await connectionService.getItemConnections(supplier.Name || supplier.name);
            orders = connections.filter(c => c.ConnectionType === 'order' || c.ConnectionType === 'transaction');
        } catch (err) {
            logger.warn('Could not load orders:', err.message);
        }
        
        res.render('suppliers/details', {
            title: `ספק - ${supplier.Name || supplier.name}`,
            supplier: supplier,
            orders: orders,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Supplier details error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת פרטי הספק'
        });
    }
});

/**
 * Create supplier page
 */
router.get('/suppliers/create', (req, res) => {
    res.render('suppliers/create', {
        title: 'הוספת ספק חדש',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Create supplier
 */
router.post('/suppliers/create', async (req, res) => {
    try {
        const { name, category, contactPerson, phone, email, address, website, taxId, status, notes } = req.body;
        
        if (!name || !name.trim()) {
            return res.render('suppliers/create', {
                title: 'הוספת ספק חדש',
                error: 'שם הספק חובה',
                user: req.user || { name: 'Guest' }
            });
        }
        
        // Insert into CI
        await executeQuery(`
            INSERT INTO CI (Name, CI_ID, CreatedAt)
            VALUES (@name, @ciId, GETDATE())
        `, { name: name.trim(), ciId: name.trim() });
        
        // Insert into DATABOX
        const fieldValues = {
            name: name.trim(),
            f0: name.trim(), // Name
            f1: category || 'General', // Category
            f2: status || 'Active', // Status
            f3: contactPerson || '', // Contact Person
            f4: phone || '', // Phone
            f5: email || '', // Email
            f6: 'Supplier', // Type
            f7: address || '', // Address
            f8: website || '', // Website
            f9: taxId || '', // Tax ID
            f10: notes || '', // Notes
            f11: new Date().toISOString(), // Created Date
            f12: req.user ? req.user.name : 'System' // Created By
        };
        
        const insertQuery = `
            INSERT INTO DATABOX (name, f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12)
            VALUES (@name, @f0, @f1, @f2, @f3, @f4, @f5, @f6, @f7, @f8, @f9, @f10, @f11, @f12)
        `;
        
        await executeQuery(insertQuery, fieldValues);
        
        req.session.successMessage = `הספק '${name}' נוסף בהצלחה!`;
        res.redirect(`/suppliers/${encodeURIComponent(name.trim())}`);
    } catch (error) {
        logger.error('Create supplier error:', error);
        res.render('suppliers/create', {
            title: 'הוספת ספק חדש',
            error: 'שגיאה בהוספת הספק',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Update supplier
 */
router.post('/suppliers/:id/update', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, contactPerson, phone, email, address, website, taxId, status, notes } = req.body;
        
        const updateQuery = `
            UPDATE DATABOX 
            SET f1 = @category,
                f2 = @status,
                f3 = @contactPerson,
                f4 = @phone,
                f5 = @email,
                f7 = @address,
                f8 = @website,
                f9 = @taxId,
                f10 = @notes
            WHERE name = @id
        `;
        
        await executeQuery(updateQuery, {
            id: id,
            category: category || 'General',
            status: status || 'Active',
            contactPerson: contactPerson || '',
            phone: phone || '',
            email: email || '',
            address: address || '',
            website: website || '',
            taxId: taxId || '',
            notes: notes || ''
        });
        
        req.session.successMessage = 'הספק עודכן בהצלחה!';
        res.redirect(`/suppliers/${encodeURIComponent(id)}`);
    } catch (error) {
        logger.error('Update supplier error:', error);
        req.session.errorMessage = 'שגיאה בעדכון הספק';
        res.redirect(`/suppliers/${encodeURIComponent(req.params.id)}`);
    }
});

/**
 * Delete supplier
 */
router.post('/suppliers/:id/delete', async (req, res) => {
    try {
        const { id } = req.params;
        
        await executeQuery('DELETE FROM DATABOX WHERE name = @id', { id });
        await executeQuery('DELETE FROM CI WHERE CI_ID = @id', { id });
        
        req.session.successMessage = 'הספק נמחק בהצלחה!';
        res.redirect('/suppliers');
    } catch (error) {
        logger.error('Delete supplier error:', error);
        req.session.errorMessage = 'שגיאה במחיקת הספק';
        res.redirect(`/suppliers/${encodeURIComponent(id)}`);
    }
});

module.exports = router;

