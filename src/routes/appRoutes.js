const express = require('express');
const router = express.Router();
const { getAppVersion } = require('../controllers/appController');
const { getSupportLinks } = require('../controllers/supportController');

// Public routes — no auth
router.get('/version', getAppVersion);
router.get('/support-links', getSupportLinks);

module.exports = router;
