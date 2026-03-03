const prisma = require('../config/database');
const { distributeTask } = require('../services/taskDistributor');
const { creditEarning, checkAndPayReferralBonus, creditReferralBonus } = require('../services/earningsService');
const constants = require('../utils/constants');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');
const { pushTaskToDevice } = require('../websocket/socketHandler');

const listUsers = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { wallet: true },
      }),
      prisma.user.count(),
    ]);

    return successResponse(res, { users, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listUsers error:', err);
    return errorResponse(res, 'Failed to list users', 'SERVER_ERROR', 500);
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { wallet: true, devices: true },
    });
    if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
    return successResponse(res, { user });
  } catch (err) {
    console.error('getUserById error:', err);
    return errorResponse(res, 'Failed to get user', 'SERVER_ERROR', 500);
  }
};

const getPlatformStats = async (req, res) => {
  try {
    const [totalUsers, totalSmsDelivered, totalEarnings, onlineDevices, pendingWithdrawals] = await Promise.all([
      prisma.user.count(),
      prisma.smsLog.count({ where: { status: 'DELIVERED' } }),
      prisma.smsLog.aggregate({ _sum: { amountEarned: true } }),
      prisma.device.count({ where: { isOnline: true } }),
      prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
    ]);

    return successResponse(res, {
      totalUsers,
      totalSmsDelivered,
      totalEarnings: totalEarnings._sum.amountEarned || 0,
      onlineDevices,
      pendingWithdrawals,
    });
  } catch (err) {
    console.error('getPlatformStats error:', err);
    return errorResponse(res, 'Failed to get platform stats', 'SERVER_ERROR', 500);
  }
};

const getOnlineDevices = async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: { isOnline: true },
      include: { user: { select: { id: true, phone: true } } },
    });
    return successResponse(res, { devices, count: devices.length });
  } catch (err) {
    console.error('getOnlineDevices error:', err);
    return errorResponse(res, 'Failed to get online devices', 'SERVER_ERROR', 500);
  }
};

const createSmsTask = async (req, res) => {
  try {
    const { recipient, message, clientId, priority = 0 } = req.body;

    const task = await prisma.smsTask.create({
      data: { recipient, message, clientId, priority },
    });

    await distributeTask(task.id, priority);

    return successResponse(res, { task }, 201);
  } catch (err) {
    console.error('createSmsTask error:', err);
    return errorResponse(res, 'Failed to create SMS task', 'SERVER_ERROR', 500);
  }
};

const bulkCreateSmsTasks = async (req, res) => {
  try {
    const { tasks } = req.body;

    const created = await prisma.$transaction(
      tasks.map((t) =>
        prisma.smsTask.create({
          data: { recipient: t.recipient, message: t.message, clientId: t.clientId, priority: t.priority || 0 },
        })
      )
    );

    for (const task of created) {
      await distributeTask(task.id, task.priority);
    }

    return successResponse(res, { tasks: created, count: created.length }, 201);
  } catch (err) {
    console.error('bulkCreateSmsTasks error:', err);
    return errorResponse(res, 'Failed to bulk create SMS tasks', 'SERVER_ERROR', 500);
  }
};

const assignTaskToUser = async (req, res) => {
  try {
    const { recipient, message, clientId, priority = 0, userId } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { devices: { where: { isOnline: true }, take: 1 } },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'User not found or inactive', 'NOT_FOUND', 404);
    }

    let device = user.devices[0];
    if (!device) {
      device = await prisma.device.findFirst({ where: { userId } });
    }

    const task = await prisma.smsTask.create({
      data: {
        recipient,
        message,
        clientId,
        priority,
        status: device ? 'ASSIGNED' : 'QUEUED',
        assignedToId: userId,
        assignedDeviceId: device?.id || null,
        assignedAt: new Date(),
      },
    });

    if (device && device.isOnline) {
      const { io } = require('../app');
      pushTaskToDevice(io, device.deviceId, task);
    }

    return successResponse(res, { task }, 201);
  } catch (err) {
    console.error('assignTaskToUser error:', err);
    return errorResponse(res, 'Failed to assign task', 'SERVER_ERROR', 500);
  }
};

const listWithdrawals = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);
    const { status } = req.query;

    const where = { type: 'WITHDRAWAL' };
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { user: { select: { id: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    return successResponse(res, { transactions, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listWithdrawals error:', err);
    return errorResponse(res, 'Failed to list withdrawals', 'SERVER_ERROR', 500);
  }
};

const approveWithdrawal = async (req, res) => {
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!transaction) return errorResponse(res, 'Transaction not found', 'NOT_FOUND', 404);
    if (transaction.status !== 'PENDING') {
      return errorResponse(res, 'Transaction is not pending', 'VALIDATION_ERROR', 422);
    }

    const updated = await prisma.transaction.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
    });

    return successResponse(res, { transaction: updated });
  } catch (err) {
    console.error('approveWithdrawal error:', err);
    return errorResponse(res, 'Failed to approve withdrawal', 'SERVER_ERROR', 500);
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });

    return successResponse(res, { user: updated });
  } catch (err) {
    console.error('toggleUserActive error:', err);
    return errorResponse(res, 'Failed to toggle user active status', 'SERVER_ERROR', 500);
  }
};

const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (req.user.id === req.params.id) {
      return errorResponse(res, 'Cannot change your own role', 'VALIDATION_ERROR', 422);
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });

    return successResponse(res, { user: updated });
  } catch (err) {
    console.error('changeUserRole error:', err);
    return errorResponse(res, 'Failed to change user role', 'SERVER_ERROR', 500);
  }
};

const rejectWithdrawal = async (req, res) => {
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!transaction) return errorResponse(res, 'Transaction not found', 'NOT_FOUND', 404);
    if (transaction.status !== 'PENDING') {
      return errorResponse(res, 'Transaction is not pending', 'VALIDATION_ERROR', 422);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId: transaction.userId },
        data: {
          balance: { increment: transaction.amount },
          totalWithdrawn: { decrement: transaction.amount },
        },
      });
      return tx.transaction.update({
        where: { id: req.params.id },
        data: { status: 'FAILED' },
      });
    });

    return successResponse(res, { transaction: updated });
  } catch (err) {
    console.error('rejectWithdrawal error:', err);
    return errorResponse(res, 'Failed to reject withdrawal', 'SERVER_ERROR', 500);
  }
};

const listSmsTasks = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);
    const { status } = req.query;

    const where = {};
    if (status) where.status = status;

    const [tasks, total] = await Promise.all([
      prisma.smsTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { assignedTo: { select: { id: true, phone: true } } },
      }),
      prisma.smsTask.count({ where }),
    ]);

    return successResponse(res, { tasks, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listSmsTasks error:', err);
    return errorResponse(res, 'Failed to list SMS tasks', 'SERVER_ERROR', 500);
  }
};

const listSmsLogs = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);
    const { status } = req.query;

    const where = {};
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, phone: true } },
          task: { select: { id: true, recipient: true, message: true } },
        },
      }),
      prisma.smsLog.count({ where }),
    ]);

    return successResponse(res, { logs, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listSmsLogs error:', err);
    return errorResponse(res, 'Failed to list SMS logs', 'SERVER_ERROR', 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    return successResponse(res, { message: 'User deleted successfully' });
  } catch (err) {
    console.error('deleteUser error:', err);
    return errorResponse(res, 'Failed to delete user', 'SERVER_ERROR', 500);
  }
};

const listTransactions = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);
    const { type, status } = req.query;

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, phone: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    return successResponse(res, { transactions, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listTransactions error:', err);
    return errorResponse(res, 'Failed to list transactions', 'SERVER_ERROR', 500);
  }
};

const getAdminPlatformSettings = async (req, res) => {
  try {
    let settings = await prisma.platformSettings.findFirst({ where: { id: 'default' } });
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { id: 'default', perRoundSendLimit: 25 },
      });
    }
    return successResponse(res, { settings });
  } catch (err) {
    console.error('getAdminPlatformSettings error:', err);
    return errorResponse(res, 'Failed to get settings', 'SERVER_ERROR', 500);
  }
};

const updateAdminPlatformSettings = async (req, res) => {
  try {
    const { perRoundSendLimit } = req.body;
    const settings = await prisma.platformSettings.upsert({
      where: { id: 'default' },
      update: { perRoundSendLimit },
      create: { id: 'default', perRoundSendLimit },
    });
    return successResponse(res, { settings });
  } catch (err) {
    console.error('updateAdminPlatformSettings error:', err);
    return errorResponse(res, 'Failed to update settings', 'SERVER_ERROR', 500);
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const task = await prisma.smsTask.findUnique({ where: { id: taskId } });
    if (!task) return errorResponse(res, 'Task not found', 'NOT_FOUND', 404);

    if (task.status === 'SENT' || task.status === 'DELIVERED' || task.status === 'FAILED') {
      return errorResponse(res, 'Task status already finalized', 'CONFLICT', 409);
    }

    const updateData = {
      status,
      sentAt: status === 'SENT' || status === 'DELIVERED' ? new Date() : undefined,
      deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
    };

    const updated = await prisma.smsTask.update({ where: { id: taskId }, data: updateData });

    if ((status === 'SENT' || status === 'DELIVERED') && task.assignedToId) {
      const amountEarned = constants.SMS_RATE_PER_DELIVERY;

      await prisma.smsLog.create({
        data: {
          userId: task.assignedToId,
          taskId,
          status,
          amountEarned,
          sentAt: status === 'SENT' || status === 'DELIVERED' ? new Date() : undefined,
          deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
        },
      });

      await creditEarning(task.assignedToId, taskId, amountEarned);

      if (task.assignedDeviceId) {
        await prisma.device.update({
          where: { id: task.assignedDeviceId },
          data: { smsSentToday: { increment: 1 } },
        });
      }

      await checkAndPayReferralBonus(task.assignedToId);
    }

    return successResponse(res, { task: updated });
  } catch (err) {
    console.error('updateTaskStatus error:', err);
    return errorResponse(res, 'Failed to update task status', 'SERVER_ERROR', 500);
  }
};

const getAdminWeeklyChart = async (req, res) => {
  try {
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);

      const [smsCount, earningsResult] = await Promise.all([
        prisma.smsLog.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.smsLog.aggregate({
          _sum: { amountEarned: true },
          where: { status: 'DELIVERED', createdAt: { gte: start, lte: end } },
        }),
      ]);

      days.push({
        name: dayNames[day.getDay()],
        sms: smsCount,
        earnings: parseFloat(earningsResult._sum.amountEarned) || 0,
      });
    }

    return successResponse(res, { days });
  } catch (err) {
    console.error('getAdminWeeklyChart error:', err);
    return errorResponse(res, 'Failed to get chart data', 'SERVER_ERROR', 500);
  }
};

const listReferrals = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);
    const { paid } = req.query;

    const where = {};
    if (paid === 'true') where.bonusPaid = true;
    if (paid === 'false') where.bonusPaid = false;

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          referrer: { select: { id: true, phone: true } },
          referred: { select: { id: true, phone: true, createdAt: true } },
        },
      }),
      prisma.referral.count({ where }),
    ]);

    return successResponse(res, { referrals, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    console.error('listReferrals error:', err);
    return errorResponse(res, 'Failed to list referrals', 'SERVER_ERROR', 500);
  }
};

const forcePayReferralBonus = async (req, res) => {
  try {
    const { referralId } = req.params;

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
    });
    if (!referral) return errorResponse(res, 'Referral not found', 'NOT_FOUND', 404);
    if (referral.bonusPaid) return errorResponse(res, 'Referral bonus already paid', 'CONFLICT', 409);

    await creditReferralBonus(referral.referrerId, referral.referredId, referral.id);

    return successResponse(res, { message: 'Referral bonus paid successfully' });
  } catch (err) {
    console.error('forcePayReferralBonus error:', err);
    return errorResponse(res, 'Failed to pay referral bonus', 'SERVER_ERROR', 500);
  }
};

module.exports = {
  listUsers, getUserById, getPlatformStats, getOnlineDevices,
  createSmsTask, bulkCreateSmsTasks, assignTaskToUser, listWithdrawals, approveWithdrawal,
  toggleUserActive, changeUserRole, rejectWithdrawal, listSmsTasks,
  listSmsLogs, deleteUser, listTransactions,
  getAdminPlatformSettings, updateAdminPlatformSettings,
  updateTaskStatus, getAdminWeeklyChart,
  listReferrals, forcePayReferralBonus,
};
