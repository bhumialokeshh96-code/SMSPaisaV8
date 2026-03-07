const express = require('express');
const router = express.Router();
const { getTeamStats, getInvitation, getTeamMembers, getTeamCommissions } = require('../controllers/teamController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', getTeamStats);
router.get('/invitation', getInvitation);
router.get('/members', getTeamMembers);
router.get('/commissions', getTeamCommissions);

module.exports = router;
