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

    // Auto-join admin room for admin users
    if (socket.user.role === 'ADMIN') {
      socket.join('admin-room');
    }

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

    socket.on('received-sms', async (data) => {
      try {
        const { deviceId, sender, message, simSlot, receivedAt, correlationId } = data;

        // Validate required fields
        if (!deviceId || !sender || !message) return;

        // Find the device
        const device = await prisma.device.findFirst({
          where: { deviceId, userId: socket.user.id },
        });
        if (!device) return;

        const parsedAt = receivedAt ? new Date(receivedAt) : new Date();

        // Reject invalid date strings
        if (isNaN(parsedAt.getTime())) return;

        // Clock skew check — reject timestamps more than 1 minute in the future
        const now = new Date();
        const CLOCK_SKEW_TOLERANCE_MS = 60_000;
        if (parsedAt > new Date(now.getTime() + CLOCK_SKEW_TOLERANCE_MS)) return;

        // Deduplication
        const existing = await prisma.receivedSmsLog.findFirst({
          where: { userId: socket.user.id, sender, receivedAt: parsedAt },
        });
        if (existing) {
          socket.emit('received-sms-ack', { id: existing.id, status: 'duplicate', correlationId });
          return;
        }

        // Create log
        const log = await prisma.receivedSmsLog.create({
          data: {
            userId: socket.user.id,
            deviceId: device.id,
            sender,
            message,
            simSlot: simSlot ?? 0,
            receivedAt: parsedAt,
          },
        });

        // Fetch full log with relations for admin push
        const fullLog = await prisma.receivedSmsLog.findUnique({
          where: { id: log.id },
          include: {
            user: { select: { id: true, phone: true, name: true } },
            device: { select: { deviceId: true, deviceName: true } },
          },
        });

        // ACK back to the phone so it knows to delete from local DB
        socket.emit('received-sms-ack', { id: log.id, status: 'saved', correlationId });

        // Push to admin panel instantly
        if (fullLog) {
          emitReceivedSmsToAdmin(io, fullLog);
        }
      } catch (err) {
        if (err.code === 'P2002') {
          // Unique constraint: treat as duplicate and still ACK so the phone can clean up
          const { sender, receivedAt, correlationId } = data;
          try {
            const parsedAt = receivedAt ? new Date(receivedAt) : null;
            const dup = parsedAt && !isNaN(parsedAt.getTime())
              ? await prisma.receivedSmsLog.findFirst({
                  where: { userId: socket.user.id, sender, receivedAt: parsedAt },
                })
              : null;
            socket.emit('received-sms-ack', { id: dup?.id ?? null, status: 'duplicate', correlationId });
          } catch (_) {
            socket.emit('received-sms-ack', { status: 'duplicate', correlationId });
          }
          return;
        }
        console.error('received-sms error:', err);
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

const emitReceivedSmsToAdmin = (io, log) => {
  io.to('admin-room').emit('new-received-sms', log);
};

module.exports = { setupSocketHandlers, pushTaskToDevice, cancelTask, emitBalanceUpdateByUserId, emitReceivedSmsToAdmin };
