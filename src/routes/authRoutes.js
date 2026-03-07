const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, forgotPassword, resetPassword, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/rateLimit');
const { validate, schemas } = require('../middleware/validation');

router.post('/register', authRateLimit, validate(schemas.register), register);
router.post('/login', authRateLimit, validate(schemas.login), login);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, validate(schemas.updateProfile), updateProfile);
router.post('/forgot-password', authRateLimit, validate(schemas.forgotPassword), forgotPassword);
router.post('/reset-password', authRateLimit, validate(schemas.resetPassword), resetPassword);
router.put('/change-password', authenticate, validate(schemas.changePassword), changePassword);

module.exports = router;
