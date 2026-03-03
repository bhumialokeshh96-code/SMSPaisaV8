const prisma = require('../config/database');
const { getNextTaskForDevice } = require('../services/taskDistributor');
const { creditEarning, checkAndPayReferralBonus } = require('../services/earningsService');
const constants = require('../utils/constants');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');

const getNextTask = async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return errorResponse(res, 'deviceId is required', 'VALIDATION_ERROR', 422);
    }

    const task = await getNextTaskForDevice(req.user.id, deviceId);
    if (!task) {
      return successResponse(res, null);
    }
    return successResponse(res, task);
  } catch (err) {
    console.error('getNextTask error:', err);
    return errorResponse(res, 'Failed to get next task', 'SERVER_ERROR', 500);
  }
};

const reportStatus = async (req, res) => {
  try {
    const { taskId, status, deviceId, errorMessage } = req.body;

    const task = await prisma.smsTask.findFirst({
      where: { id: taskId, assignedToId: req.user.id },
    });

    if (!task) {
      return errorResponse(res, 'Task not found or not assigned to you', 'NOT_FOUND', 404);
    }

    // Block terminal statuses
    if (task.status === 'DELIVERED' || task.status === 'FAILED') {
      return errorResponse(res, 'Task already in terminal status', 'CONFLICT', 409);
    }

    // Block same-status re-reports (e.g., SENT → SENT)
    if (task.status === status) {
      return errorResponse(res, 'Task status already reported', 'CONFLICT', 409);
    }

    // Only allow valid transitions:
    // ASSIGNED → SENT, ASSIGNED → DELIVERED, ASSIGNED → FAILED
    // SENT → DELIVERED, SENT → FAILED
    const validTransitions = {
      'ASSIGNED': ['SENT', 'DELIVERED', 'FAILED'],
      'SENT': ['DELIVERED', 'FAILED'],
    };

    const allowed = validTransitions[task.status];
    if (!allowed || !allowed.includes(status)) {
      return errorResponse(res, `Invalid status transition from ${task.status} to ${status}`, 'INVALID_TRANSITION', 400);
    }

    const updateData = {
      status,
      sentAt: (status === 'SENT' || status === 'DELIVERED') && !task.sentAt ? new Date() : task.sentAt,
      deliveredAt: status === 'DELIVERED' ? new Date() : task.deliveredAt,
    };

    await prisma.smsTask.update({ where: { id: taskId }, data: updateData });

    // Check if earnings were already credited for this task (only needed for successful statuses)
    const existingEarningLog = (status === 'SENT' || status === 'DELIVERED')
      ? await prisma.smsLog.findFirst({
          where: { taskId, userId: req.user.id, amountEarned: { gt: 0 } },
        })
      : null;

    // Only credit earnings on first successful status (SENT or DELIVERED), never twice
    const shouldCredit = (status === 'SENT' || status === 'DELIVERED') && !existingEarningLog;
    const amountEarned = shouldCredit ? constants.SMS_RATE_PER_DELIVERY : 0;

    let log;
    try {
      log = await prisma.smsLog.create({
        data: {
          userId: req.user.id,
          taskId,
          status,
          amountEarned,
          sentAt: status === 'SENT' || status === 'DELIVERED' ? new Date() : undefined,
          deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
        },
      });
    } catch (createErr) {
      // P2002: unique constraint violation — log already exists for this taskId+status (retry scenario)
      if (createErr.code === 'P2002') {
        log = await prisma.smsLog.findFirst({ where: { taskId, status } });
        return successResponse(res, { log, amountEarned: 0 });
      }
      throw createErr;
    }

    if (shouldCredit) {
      await creditEarning(req.user.id, taskId, amountEarned);
      await prisma.device.updateMany({
        where: { deviceId, userId: req.user.id },
        data: { smsSentToday: { increment: 1 } },
      });
      await checkAndPayReferralBonus(req.user.id);
    }

    return successResponse(res, { log, amountEarned });
  } catch (err) {
    console.error('reportStatus error:', err);
    return errorResponse(res, 'Failed to report status', 'SERVER_ERROR', 500);
  }
};

const getTodayStats = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [total, delivered, failed] = await Promise.all([
      prisma.smsLog.count({ where: { userId: req.user.id, createdAt: { gte: startOfDay } } }),
      prisma.smsLog.count({ where: { userId: req.user.id, status: { in: ['SENT', 'DELIVERED'] }, createdAt: { gte: startOfDay } } }),
      prisma.smsLog.count({ where: { userId: req.user.id, status: 'FAILED', createdAt: { gte: startOfDay } } }),
    ]);

    const earningsResult = await prisma.smsLog.aggregate({
      _sum: { amountEarned: true },
      where: { userId: req.user.id, status: { in: ['SENT', 'DELIVERED'] }, createdAt: { gte: startOfDay } },
    });

    return successResponse(res, {
      sent: total,
      delivered,
      failed,
      earnings: parseFloat(earningsResult._sum.amountEarned) || 0,
      remaining: 0,
    });
  } catch (err) {
    console.error('getTodayStats error:', err);
    return errorResponse(res, 'Failed to get today stats', 'SERVER_ERROR', 500);
  }
};

const getSmsLog = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where: { userId: req.user.id },
        include: { task: { select: { recipient: true, message: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.smsLog.count({ where: { userId: req.user.id } }),
    ]);

    const flatLogs = logs.map(log => ({
      id: log.id,
      taskId: log.taskId,
      recipient: log.task?.recipient || '',
      message: log.task?.message || '',
      status: log.status,
      amount: parseFloat(log.amountEarned) || 0,
      timestamp: new Date(log.createdAt).getTime(),
    }));

    return successResponse(res, flatLogs);
  } catch (err) {
    console.error('getSmsLog error:', err);
    return errorResponse(res, 'Failed to get SMS log', 'SERVER_ERROR', 500);
  }
};

const getBatchTasks = async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return errorResponse(res, 'deviceId is required', 'VALIDATION_ERROR', 422);
    }

    const device = await prisma.device.findFirst({ where: { deviceId, userId: req.user.id } });
    if (!device) {
      return errorResponse(res, 'Device not found or not owned by you', 'NOT_FOUND', 404);
    }

    const settings = await prisma.platformSettings.findFirst({ where: { id: 'default' } });
    const roundLimit = settings?.perRoundSendLimit || 25;

    const existing = await prisma.smsTask.findMany({
      where: { status: 'ASSIGNED', assignedToId: req.user.id, assignedDeviceId: device.id },
    });

    if (existing.length > 0) {
      // Reset stale ASSIGNED tasks (older than 5 minutes) so they can be re-assigned
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
      const staleIds = [];
      const fresh = [];
      for (const t of existing) {
        if (t.assignedAt && t.assignedAt < staleThreshold) {
          staleIds.push(t.id);
        } else {
          fresh.push(t);
        }
      }
      if (staleIds.length > 0) {
        await prisma.smsTask.updateMany({
          where: { id: { in: staleIds } },
          data: { status: 'QUEUED', assignedToId: null, assignedDeviceId: null, assignedAt: null },
        });
        if (fresh.length > 0) {
          return successResponse(res, { tasks: fresh, roundLimit });
        }
        // All were stale — fall through to assign new tasks below
      } else {
        return successResponse(res, { tasks: existing, roundLimit });
      }
    }

    const tasks = await prisma.$transaction(async (tx) => {
      const queued = await tx.smsTask.findMany({
        where: { status: 'QUEUED' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: roundLimit,
      });

      if (queued.length === 0) return [];

      const now = new Date();
      await tx.smsTask.updateMany({
        where: { id: { in: queued.map((t) => t.id) } },
        data: {
          status: 'ASSIGNED',
          assignedToId: req.user.id,
          assignedDeviceId: device.id,
          assignedAt: now,
        },
      });

      return queued.map((t) => ({ ...t, status: 'ASSIGNED', assignedToId: req.user.id, assignedDeviceId: device.id, assignedAt: now }));
    });

    return successResponse(res, { tasks, roundLimit });
  } catch (err) {
    console.error('getBatchTasks error:', err);
    return errorResponse(res, 'Failed to get batch tasks', 'SERVER_ERROR', 500);
  }
};

module.exports = { getNextTask, reportStatus, getTodayStats, getSmsLog, getBatchTasks };