const express = require('express');
const router = express.Router();
router.get('/deepsearch', (req, res) => res.redirect('/datablocks'));
module.exports = router;

