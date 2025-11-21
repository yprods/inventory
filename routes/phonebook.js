/**
 * Phone Book Routes
 */

const express = require('express');
const router = express.Router();
const { executeQuery, executeSqliteQuery } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Phone book list page
 */
router.get('/phonebook', async (req, res) => {
    try {
        const { search, department, category } = req.query;
        
        let query = `
            SELECT TOP 200 
                CI.Name, CI.CI_ID, CI.CreatedAt,
                DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE (CI.Name LIKE @search OR DATABOX.f0 LIKE @search OR DATABOX.f3 LIKE @search)
            AND DATABOX.f6 = 'Contact'
        `;
        
        const params = { search: `%${search || ''}%` };
        
        if (department) {
            query += ` AND DATABOX.f2 LIKE @department`;
            params.department = `%${department}%`;
        }
        if (category) {
            query += ` AND DATABOX.f1 = @category`;
            params.category = category;
        }
        
        query += ` ORDER BY CI.Name`;
        
        const contacts = await executeQuery(query, params);
        
        // Get departments and categories
        const departments = await executeQuery(`
            SELECT DISTINCT f2 as department
            FROM DATABOX
            WHERE f6 = 'Contact' AND f2 IS NOT NULL
            ORDER BY f2
        `);
        
        const categories = await executeQuery(`
            SELECT DISTINCT f1 as category
            FROM DATABOX
            WHERE f6 = 'Contact' AND f1 IS NOT NULL
            ORDER BY f1
        `);
        
        res.render('phonebook/index', {
            title: 'ספר טלפונים',
            contacts: contacts || [],
            departments: departments || [],
            categories: categories || [],
            search: search || '',
            department: department || '',
            category: category || '',
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Phone book page error:', error);
        res.render('phonebook/index', {
            title: 'ספר טלפונים',
            contacts: [],
            departments: [],
            categories: [],
            error: 'שגיאה בטעינת ספר הטלפונים',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Contact details page
 */
router.get('/phonebook/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT CI.*, DATABOX.*
            FROM CI
            LEFT JOIN DATABOX ON CI.CI_ID = DATABOX.name
            WHERE CI.CI_ID = @id OR CI.Name = @id
        `;
        
        const results = await executeQuery(query, { id });
        const contact = results[0] || null;
        
        if (!contact) {
            return res.status(404).render('error', {
                title: '404',
                message: 'איש קשר לא נמצא'
            });
        }
        
        res.render('phonebook/details', {
            title: `איש קשר - ${contact.Name || contact.name}`,
            contact: contact,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Contact details error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת פרטי איש הקשר'
        });
    }
});

/**
 * Create contact page
 */
router.get('/phonebook/create', (req, res) => {
    res.render('phonebook/create', {
        title: 'הוספת איש קשר',
        user: req.user || { name: 'Guest' }
    });
});

/**
 * Create contact
 */
router.post('/phonebook/create', async (req, res) => {
    try {
        const { name, phone, mobile, email, department, position, category, notes } = req.body;
        
        if (!name || !name.trim()) {
            return res.render('phonebook/create', {
                title: 'הוספת איש קשר',
                error: 'שם איש הקשר חובה',
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
            f2: department || '', // Department
            f3: phone || '', // Phone
            f4: mobile || '', // Mobile
            f5: email || '', // Email
            f6: 'Contact', // Type
            f7: position || '', // Position
            f8: notes || '', // Notes
            f9: new Date().toISOString(), // Created Date
            f10: req.user ? req.user.name : 'System' // Created By
        };
        
        const insertQuery = `
            INSERT INTO DATABOX (name, f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10)
            VALUES (@name, @f0, @f1, @f2, @f3, @f4, @f5, @f6, @f7, @f8, @f9, @f10)
        `;
        
        await executeQuery(insertQuery, fieldValues);
        
        req.session.successMessage = `איש הקשר '${name}' נוסף בהצלחה!`;
        res.redirect(`/phonebook/${encodeURIComponent(name.trim())}`);
    } catch (error) {
        logger.error('Create contact error:', error);
        res.render('phonebook/create', {
            title: 'הוספת איש קשר',
            error: 'שגיאה בהוספת איש הקשר',
            user: req.user || { name: 'Guest' }
        });
    }
});

/**
 * Update contact
 */
router.post('/phonebook/:id/update', async (req, res) => {
    try {
        const { id } = req.params;
        const { phone, mobile, email, department, position, category, notes } = req.body;
        
        const updateQuery = `
            UPDATE DATABOX 
            SET f1 = @category,
                f2 = @department,
                f3 = @phone,
                f4 = @mobile,
                f5 = @email,
                f7 = @position,
                f8 = @notes
            WHERE name = @id
        `;
        
        await executeQuery(updateQuery, {
            id: id,
            category: category || 'General',
            department: department || '',
            phone: phone || '',
            mobile: mobile || '',
            email: email || '',
            position: position || '',
            notes: notes || ''
        });
        
        req.session.successMessage = 'איש הקשר עודכן בהצלחה!';
        res.redirect(`/phonebook/${encodeURIComponent(id)}`);
    } catch (error) {
        logger.error('Update contact error:', error);
        req.session.errorMessage = 'שגיאה בעדכון איש הקשר';
        res.redirect(`/phonebook/${encodeURIComponent(req.params.id)}`);
    }
});

/**
 * Delete contact
 */
router.post('/phonebook/:id/delete', async (req, res) => {
    try {
        const { id } = req.params;
        
        await executeQuery('DELETE FROM DATABOX WHERE name = @id', { id });
        await executeQuery('DELETE FROM CI WHERE CI_ID = @id', { id });
        
        req.session.successMessage = 'איש הקשר נמחק בהצלחה!';
        res.redirect('/phonebook');
    } catch (error) {
        logger.error('Delete contact error:', error);
        req.session.errorMessage = 'שגיאה במחיקת איש הקשר';
        res.redirect(`/phonebook/${encodeURIComponent(id)}`);
    }
});

module.exports = router;

