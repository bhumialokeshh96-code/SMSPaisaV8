'use strict';

/**
 * WhatsApp API routes
 *
 * POST /api/whatsapp/pair    – Request an 8-digit pairing code
 * GET  /api/whatsapp/status  – Return the user's current whatsappStatus
 * POST /api/whatsapp/unlink  – Log out and clean up the user's session
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requestPairingCode, logout } = require('../whatsapp/WaManager');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');

/** All WhatsApp routes require a valid JWT */
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /api/whatsapp/pair
// Body: { phoneNumber: "919876543210" }
// ---------------------------------------------------------------------------
const pairSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\d{7,15}$/)
    .required()
    .messages({
      'string.pattern.base': 'phoneNumber must contain only digits (7-15 characters, include country code)',
    }),
});

router.post('/pair', async (req, res) => {
  const { error, value } = pairSchema.validate(req.body);
  if (error) {
    return errorResponse(res, error.details[0].message, 'VALIDATION_ERROR', 422);
  }

  const { phoneNumber } = value;
  const userId = req.user.id;

  try {
    const code = await requestPairingCode(userId, phoneNumber);
    return successResponse(res, { pairingCode: code });
  } catch (err) {
    console.error(`[WhatsApp] Pair error for user ${userId}:`, err.message);
    return errorResponse(res, 'Failed to generate pairing code. Please try again.', 'WA_PAIR_ERROR', 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/whatsapp/status
// ---------------------------------------------------------------------------
router.get('/status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { whatsappStatus: true, whatsappNumber: true },
    });

    if (!user) {
      return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
    }

    return successResponse(res, {
      status: user.whatsappStatus,
      whatsappNumber: user.whatsappNumber ?? null,
    });
  } catch (err) {
    console.error(`[WhatsApp] Status error for user ${req.user.id}:`, err.message);
    return errorResponse(res, 'Failed to retrieve WhatsApp status', 'WA_STATUS_ERROR', 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/whatsapp/unlink
// ---------------------------------------------------------------------------
router.post('/unlink', async (req, res) => {
  const userId = req.user.id;
  try {
    await logout(userId);
    return successResponse(res, { message: 'WhatsApp account unlinked successfully' });
  } catch (err) {
    console.error(`[WhatsApp] Unlink error for user ${userId}:`, err.message);
    return errorResponse(res, 'Failed to unlink WhatsApp account', 'WA_UNLINK_ERROR', 500);
  }
});

module.exports = router;
