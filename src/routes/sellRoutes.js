const express = require('express');
const router = express.Router();
const { getSellStatus, activateSellHandler } = require('../controllers/sellController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/status', getSellStatus);
router.post('/activate', activateSellHandler);

module.exports = router;
