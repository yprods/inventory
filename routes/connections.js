/**
 * Connection Map Routes
 */

const express = require('express');
const router = express.Router();
const connectionMapService = require('../services/connectionMapService');
const logger = require('../utils/logger');

/**
 * Connection map visualization page
 */
router.get('/connections/map', async (req, res) => {
    try {
        const { item } = req.query;
        
        let mapData = null;
        let itemConnections = null;
        
        if (item) {
            itemConnections = await connectionMapService.getItemConnections(item);
        } else {
            mapData = await connectionMapService.getFullConnectionMap();
        }
        
        res.render('connections/map', {
            title: 'מפת קשרים',
            item: item || null,
            mapData: mapData,
            itemConnections: itemConnections,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Connection map page error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת מפת הקשרים'
        });
    }
});

/**
 * Item connections page
 */
router.get('/connections/item/:itemName', async (req, res) => {
    try {
        const { itemName } = req.params;
        const connections = await connectionMapService.getItemConnections(itemName);
        const relatedItems = await connectionMapService.getRelatedItems(itemName);
        
        res.render('connections/item', {
            title: `קשרים - ${itemName}`,
            itemName: itemName,
            connections: connections,
            relatedItems: relatedItems,
            user: req.user || { name: 'Guest' }
        });
    } catch (error) {
        logger.error('Item connections page error:', error);
        res.status(500).render('error', {
            title: 'שגיאה',
            message: 'שגיאה בטעינת הקשרים'
        });
    }
});

module.exports = router;

