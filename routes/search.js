const express = require('express');
const router = express.Router();
router.get('/search', (req, res) => res.redirect('/datablocks'));
module.exports = router;

