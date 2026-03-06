const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');
const { emitReceivedSmsToAdmin } = require('../websocket/socketHandler');

// Called by Android app to report a newly received SMS
const reportReceivedSms = async (req, res) => {
  try {
    const { deviceId, sender, message, simSlot, receivedAt } = req.body;

    const device = await prisma.device.findFirst({
      where: { deviceId, userId: req.user.id },
    });

    if (!device) {
      return errorResponse(res, 'Device not found', 'NOT_FOUND', 404);
    }

    const parsedAt = receivedAt ? new Date(receivedAt) : new Date();
    const now = new Date();
    const CLOCK_SKEW_TOLERANCE_MS = 60_000;
    if (parsedAt > new Date(now.getTime() + CLOCK_SKEW_TOLERANCE_MS)) {
      return errorResponse(res, 'receivedAt cannot be in the future', 'VALIDATION_ERROR', 422);
    }

    // Deduplication: return existing record if same userId + sender + receivedAt already stored
    const existing = await prisma.receivedSmsLog.findFirst({
      where: { userId: req.user.id, sender, receivedAt: parsedAt },
    });
    if (existing) {
      return successResponse(res, { log: existing });
    }

    const log = await prisma.receivedSmsLog.create({
      data: {
        userId: req.user.id,
        deviceId: device.id,
        sender,
        message,
        simSlot: simSlot ?? 0,
        receivedAt: parsedAt,
      },
    });

    // Fetch full log with relations for WebSocket event payload
    const fullLog = await prisma.receivedSmsLog.findUnique({
      where: { id: log.id },
      include: {
        user: { select: { id: true, phone: true, name: true } },
        device: { select: { deviceId: true, deviceName: true } },
      },
    });

    // Emit real-time event to admin room
    const io = req.app.get('io');
    if (io && fullLog) {
      emitReceivedSmsToAdmin(io, fullLog);
    }

    return successResponse(res, { log });
  } catch (err) {
    // P2002: unique constraint violation — treat as duplicate (idempotent)
    if (err.code === 'P2002') {
      return successResponse(res, { log: null, duplicate: true });
    }
    console.error('reportReceivedSms error:', err);
    return errorResponse(res, 'Failed to save received SMS', 'SERVER_ERROR', 500);
  }
};

// Admin: list all received SMS logs with pagination and optional filters
const listReceivedSmsLogs = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);
    const { sender, userId, from, to } = req.query;

    const where = {};
    if (sender) where.sender = { contains: sender, mode: 'insensitive' };
    if (userId) where.userId = userId;
    if (from || to) {
      where.receivedAt = {};
      if (from) where.receivedAt.gte = new Date(from);
      if (to) where.receivedAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.receivedSmsLog.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, phone: true, name: true } },
          device: { select: { deviceId: true, deviceName: true } },
        },
      }),
      prisma.receivedSmsLog.count({ where }),
    ]);

    return successResponse(res, { logs, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listReceivedSmsLogs error:', err);
    return errorResponse(res, 'Failed to list received SMS logs', 'SERVER_ERROR', 500);
  }
};

module.exports = { reportReceivedSms, listReceivedSmsLogs };
