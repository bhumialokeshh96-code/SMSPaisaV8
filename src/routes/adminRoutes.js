const express = require('express');
const router = express.Router();
const {
  listUsers, getUserById, getPlatformStats, getOnlineDevices,
  createSmsTask, bulkCreateSmsTasks, assignTaskToUser, listWithdrawals, approveWithdrawal,
  toggleUserActive, changeUserRole, rejectWithdrawal, listSmsTasks,
  listSmsLogs, deleteUser, listTransactions,
  getAdminPlatformSettings, updateAdminPlatformSettings,
  updateTaskStatus, getAdminWeeklyChart,
  listReferrals, forcePayReferralBonus,
} = require('../controllers/adminController');
const { updateAppVersion } = require('../controllers/appController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate, requireAdmin);

router.get('/users', listUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/toggle-active', toggleUserActive);
router.put('/users/:id/role', validate(schemas.changeUserRole), changeUserRole);
router.delete('/users/:id', deleteUser);
router.get('/stats', getPlatformStats);
router.get('/devices', getOnlineDevices);
router.post('/sms/create-task', validate(schemas.createTask), createSmsTask);
router.post('/sms/bulk-create', validate(schemas.bulkCreateTask), bulkCreateSmsTasks);
router.post('/sms/assign-task', validate(schemas.assignTask), assignTaskToUser);
router.get('/sms/tasks', listSmsTasks);
router.get('/sms/logs', listSmsLogs);
router.get('/withdrawals', listWithdrawals);
router.put('/withdrawals/:id/approve', approveWithdrawal);
router.put('/withdrawals/:id/reject', rejectWithdrawal);
router.get('/transactions', listTransactions);
router.get('/settings', getAdminPlatformSettings);
router.put('/settings', validate(schemas.updateSettings), updateAdminPlatformSettings);
router.patch('/tasks/:taskId/status', validate(schemas.updateTaskStatus), updateTaskStatus);
router.put('/app/version', updateAppVersion);
router.get('/chart/weekly', getAdminWeeklyChart);
router.get('/referrals', listReferrals);
router.post('/referrals/:referralId/force-pay', forcePayReferralBonus);

module.exports = router;
