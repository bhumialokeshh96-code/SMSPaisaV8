const express = require('express');
const router = express.Router();
const { getNextTask, reportStatus, getTodayStats, getSmsLog, getBatchTasks } = require('../controllers/smsController');
const { reportReceivedSms } = require('../controllers/receivedSmsController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.get('/next-task', getNextTask);
router.get('/batch-tasks', getBatchTasks);
router.post('/report-status', validate(schemas.reportStatus), reportStatus);
router.get('/today-stats', getTodayStats);
router.get('/log', getSmsLog);
router.post('/received', reportReceivedSms);

module.exports = router;
