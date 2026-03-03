const express = require('express');
const router = express.Router();
const { requestWithdrawal, getWithdrawalHistory, addUpi, addBank } = require('../controllers/withdrawController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.post('/request', validate(schemas.requestWithdrawal), requestWithdrawal);
router.get('/history', getWithdrawalHistory);
router.post('/add-upi', addUpi);
router.post('/add-bank', addBank);

module.exports = router;
