const express = require('express');
const router = express.Router();
const { registerDevice, updateDeviceSettings, heartbeat, listDevices } = require('../controllers/deviceController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.post('/register', validate(schemas.registerDevice), registerDevice);
router.put('/settings', validate(schemas.updateDevice), updateDeviceSettings);
router.post('/heartbeat', validate(schemas.heartbeat), heartbeat);
router.get('/list', listDevices);

module.exports = router;
