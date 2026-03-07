const express = require('express');
const router = express.Router();
const { requestWithdrawal, getWithdrawalHistory } = require('../controllers/withdrawalController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/request', requestWithdrawal);
router.get('/history', getWithdrawalHistory);

module.exports = router;
