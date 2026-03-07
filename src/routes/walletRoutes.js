const express = require('express');
const router = express.Router();
const { getBalance, getTransactions, getPaymentAccounts, claimNewbieRewardHandler } = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/balance', getBalance);
router.get('/transactions', getTransactions);
router.get('/payment-accounts', getPaymentAccounts);
router.post('/claim-newbie-reward', claimNewbieRewardHandler);

module.exports = router;
