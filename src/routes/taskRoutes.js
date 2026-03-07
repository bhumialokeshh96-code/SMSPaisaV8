const express = require('express');
const router = express.Router();
const { getAvailableTasks, claimTask, uploadProof, getMyTasks, getTaskHistory } = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/available', getAvailableTasks);
router.post('/:id/claim', claimTask);
router.post('/:id/upload-proof', uploadProof);
router.get('/my-tasks', getMyTasks);
router.get('/history', getTaskHistory);

module.exports = router;
