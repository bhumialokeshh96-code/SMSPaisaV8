const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');

// Called by Android app to report a newly received SMS
const reportReceivedSms = async (req, res) => {
  try {
    const { deviceId, sender, message, simSlot, receivedAt } = req.body;

    if (!deviceId || !sender || !message) {
      return errorResponse(res, 'deviceId, sender and message are required', 'VALIDATION_ERROR', 422);
    }

    const device = await prisma.device.findFirst({
      where: { deviceId, userId: req.user.id },
    });

    if (!device) {
      return errorResponse(res, 'Device not found', 'NOT_FOUND', 404);
    }

    const parsedAt = receivedAt ? new Date(receivedAt) : new Date();
    const now = new Date();
    if (parsedAt > now) {
      return errorResponse(res, 'receivedAt cannot be in the future', 'VALIDATION_ERROR', 422);
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

    return successResponse(res, { log });
  } catch (err) {
    console.error('reportReceivedSms error:', err);
    return errorResponse(res, 'Failed to save received SMS', 'SERVER_ERROR', 500);
  }
};

// Admin: list all received SMS logs with pagination
const listReceivedSmsLogs = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);

    const [logs, total] = await Promise.all([
      prisma.receivedSmsLog.findMany({
        orderBy: { receivedAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, phone: true, name: true } },
          device: { select: { deviceId: true, deviceName: true } },
        },
      }),
      prisma.receivedSmsLog.count(),
    ]);

    return successResponse(res, { logs, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listReceivedSmsLogs error:', err);
    return errorResponse(res, 'Failed to list received SMS logs', 'SERVER_ERROR', 500);
  }
};

module.exports = { reportReceivedSms, listReceivedSmsLogs };
