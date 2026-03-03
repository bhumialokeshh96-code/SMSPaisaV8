const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { creditEarning, checkAndPayReferralBonus } = require('../services/earningsService');
const constants = require('../utils/constants');

const connectedDevices = new Map();
const connectedUsers = new Map();

const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, phone: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) return next(new Error('User not found or inactive'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user.id})`);
    connectedUsers.set(socket.user.id, socket.id);

    socket.on('device-status', async (data) => {
      try {
        const { deviceId, isOnline } = data;
        const device = await prisma.device.findFirst({
          where: { deviceId, userId: socket.user.id },
        });
        if (device) {
          await prisma.device.update({
            where: { id: device.id },
            data: { isOnline, lastSeen: new Date() },
          });
          connectedDevices.set(deviceId, { socketId: socket.id, userId: socket.user.id });
        }
      } catch (err) {
        console.error('device-status error:', err);
      }
    });

    socket.on('heartbeat', async (data) => {
      try {
        const { deviceId } = data;
        const device = await prisma.device.findFirst({
          where: { deviceId, userId: socket.user.id },
        });
        if (device) {
          await prisma.device.update({
            where: { id: device.id },
            data: { lastSeen: new Date(), isOnline: true },
          });
        }
        socket.emit('heartbeat-ack', { timestamp: Date.now() });
      } catch (err) {
        console.error('heartbeat error:', err);
      }
    });

    socket.on('task-result', async (data) => {
      try {
        const { taskId, status, deviceId } = data;

        const validStatuses = ['SENT', 'DELIVERED', 'FAILED'];
        if (!validStatuses.includes(status)) return;

        const task = await prisma.smsTask.findFirst({
          where: { id: taskId, assignedToId: socket.user.id },
        });

        if (!task) return;

        // Block terminal statuses
        if (task.status === 'DELIVERED' || task.status === 'FAILED') return;

        // Block same-status re-reports
        if (task.status === status) return;

        // Only allow valid transitions
        const validTransitions = {
          'ASSIGNED': ['SENT', 'DELIVERED', 'FAILED'],
          'SENT': ['DELIVERED', 'FAILED'],
        };
        const allowed = validTransitions[task.status];
        if (!allowed || !allowed.includes(status)) return;

        await prisma.smsTask.update({
          where: { id: taskId },
          data: {
            status,
            sentAt: (status === 'SENT' || status === 'DELIVERED') && !task.sentAt ? new Date() : task.sentAt,
            deliveredAt: status === 'DELIVERED' ? new Date() : task.deliveredAt,
          },
        });

        // Only credit earnings on first successful status, never twice
        const existingEarningLog = (status === 'SENT' || status === 'DELIVERED')
          ? await prisma.smsLog.findFirst({
              where: { taskId, userId: socket.user.id, amountEarned: { gt: 0 } },
            })
          : null;

        const shouldCredit = (status === 'SENT' || status === 'DELIVERED') && !existingEarningLog;
        const amountEarned = shouldCredit ? constants.SMS_RATE_PER_DELIVERY : 0;

        try {
          await prisma.smsLog.create({
            data: {
              userId: socket.user.id,
              taskId,
              status,
              amountEarned,
              sentAt: status === 'SENT' || status === 'DELIVERED' ? new Date() : undefined,
              deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
            },
          });
        } catch (createErr) {
          // P2002: unique constraint — log already exists for this taskId+status (retry scenario)
          if (createErr.code !== 'P2002') throw createErr;
          return;
        }

        if (shouldCredit) {
          const { wallet } = await creditEarning(socket.user.id, taskId, amountEarned);
          if (deviceId) {
            await prisma.device.updateMany({
              where: { deviceId, userId: socket.user.id },
              data: { smsSentToday: { increment: 1 } },
            });
          }
          socket.emit('balance-updated', { balance: parseFloat(wallet.balance) });
          const emitFn = (userId, balance) => {
            const socketId = connectedUsers.get(userId);
            if (socketId) io.to(socketId).emit('balance-updated', { balance });
          };
          await checkAndPayReferralBonus(socket.user.id, emitFn);
        }
      } catch (err) {
        console.error('task-result error:', err);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      connectedUsers.delete(socket.user.id);
      for (const [deviceId, info] of connectedDevices.entries()) {
        if (info.socketId === socket.id) {
          connectedDevices.delete(deviceId);
          try {
            const device = await prisma.device.findFirst({
              where: { deviceId, userId: socket.user.id },
            });
            if (device) {
              await prisma.device.update({
                where: { id: device.id },
                data: { isOnline: false },
              });
            }
          } catch (err) {
            console.error('disconnect cleanup error:', err);
          }
        }
      }
    });
  });

  return io;
};

const pushTaskToDevice = (io, deviceId, task) => {
  const deviceInfo = connectedDevices.get(deviceId);
  if (deviceInfo) {
    io.to(deviceInfo.socketId).emit('new-task', {
      taskId: task.id || task.taskId,
      recipient: task.recipient,
      message: task.message,
      priority: task.priority,
    });
    return true;
  }
  return false;
};

const cancelTask = (io, deviceId, taskId) => {
  const deviceInfo = connectedDevices.get(deviceId);
  if (deviceInfo) {
    io.to(deviceInfo.socketId).emit('task-cancelled', { taskId });
    return true;
  }
  return false;
};

const emitBalanceUpdateByUserId = (io, userId, balance) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit('balance-updated', { balance });
  }
};

module.exports = { setupSocketHandlers, pushTaskToDevice, cancelTask, emitBalanceUpdateByUserId };
