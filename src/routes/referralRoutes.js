const express = require('express');
const router = express.Router();
const { getReferralCode, applyReferral, getReferralStats } = require('../controllers/referralController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.get('/code', getReferralCode);
router.post('/apply', validate(schemas.applyReferral), applyReferral);
router.get('/stats', getReferralStats);

module.exports = router;
