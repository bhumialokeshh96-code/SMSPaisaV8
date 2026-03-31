'use strict';

/**
 * WhatsApp API routes
 *
 * POST /api/whatsapp/bind    – Bind a phone number via external proxy
 * GET  /api/whatsapp/status  – Return the user's current whatsapp status
 * POST /api/whatsapp/unlink  – Unlink the user's WhatsApp number
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');

/** All WhatsApp routes require a valid JWT */
router.use(authenticate);

const PROXY_BASE = 'https://win03.club/api/v1/member/ws';

const proxyHeaders = () => ({
  Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
});

function normalizePhone(phone) {
  return '91' + phone.replace(/\D/g, '').slice(-10);
}

// ---------------------------------------------------------------------------
// POST /api/whatsapp/bind
// Body: { phone }
// ---------------------------------------------------------------------------
router.post('/bind', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return errorResponse(res, 'phone is required', 'VALIDATION_ERROR', 422);
  }

  const normalizedPhone = normalizePhone(phone);
  if (!/^\d{12}$/.test(normalizedPhone)) {
    return errorResponse(res, 'Invalid phone number', 'VALIDATION_ERROR', 422);
  }
  const userId = req.user.id;

  try {
    const proxyRes = await fetch(`${PROXY_BASE}/auth/${normalizedPhone}`, {
      headers: proxyHeaders(),
    });

    if (!proxyRes.ok) {
      return successResponse(res, { status: 'failed', message: 'Not Connected' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { whatsappNumber: normalizedPhone },
    });

    return successResponse(res, {
      status: 'success',
      message: 'Bind Successfully',
      pairingCode: 'AAAAAAAA',
    });
  } catch (err) {
    console.error(`[WhatsApp] Bind error for user ${userId}:`, err.message);
    return successResponse(res, { status: 'failed', message: 'Not Connected' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/whatsapp/status
// ---------------------------------------------------------------------------
router.get('/status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { whatsappNumber: true },
    });

    if (!user) {
      return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
    }

    const userPhone = user.whatsappNumber;
    if (!userPhone) {
      return successResponse(res, { phone: null, status: 'not_connected', sendTime: 0 });
    }

    const proxyRes = await fetch(`${PROXY_BASE}/task/desc`, {
      headers: proxyHeaders(),
    });

    if (!proxyRes.ok) {
      return successResponse(res, { phone: userPhone, status: 'not_connected', sendTime: 0 });
    }

    const proxyData = await proxyRes.json();
    const wsOnline = proxyData?.wsOnline ?? [];
    const userData = wsOnline.find((item) => item.wsNumber === userPhone);

    let status = 'not_connected';
    let sendTime = 0;
    if (userData) {
      status = userData.isOnline === 1 ? 'online' : 'offline';
      sendTime = userData.sendTime || 0;
    }

    return successResponse(res, { phone: userPhone, status, sendTime });
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
    await prisma.user.update({
      where: { id: userId },
      data: { whatsappNumber: null },
    });
    return successResponse(res, { message: 'WhatsApp account unlinked successfully' });
  } catch (err) {
    console.error(`[WhatsApp] Unlink error for user ${userId}:`, err.message);
    return errorResponse(res, 'Failed to unlink WhatsApp account', 'WA_UNLINK_ERROR', 500);
  }
});

module.exports = router;
