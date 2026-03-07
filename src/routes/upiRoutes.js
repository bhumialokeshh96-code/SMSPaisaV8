const express = require('express');
const router = express.Router();
const { listUpiAccounts, addUpiAccount, updateUpiAccount, removeUpiAccount } = require('../controllers/upiController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/list', listUpiAccounts);
router.post('/add', addUpiAccount);
router.put('/:id/update', updateUpiAccount);
router.delete('/:id/remove', removeUpiAccount);

module.exports = router;
