const express = require('express');
const router = express.Router();
const { getOverview, getDailyStats, getWeeklyStats, getMonthlyStats } = require('../controllers/statsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/overview', getOverview);
router.get('/daily', getDailyStats);
router.get('/weekly', getWeeklyStats);
router.get('/monthly', getMonthlyStats);

module.exports = router;
