const cron = require('node-cron');
const prisma = require('../config/database');

const startStaleTaskCleanup = () => {
  // Runs at minute 0 of every hour — resets stale ASSIGNED tasks (stuck for >5 minutes) back to QUEUED
  cron.schedule('0 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000);
      const result = await prisma.smsTask.updateMany({
        where: { status: 'ASSIGNED', assignedAt: { lt: cutoff } },
        data: { status: 'QUEUED', assignedToId: null, assignedDeviceId: null, assignedAt: null },
      });
      console.log(`Stale task cleanup: reset ${result.count} task(s) to QUEUED`);
    } catch (err) {
      console.error('Stale task cleanup error:', err);
    }
  });

  // Runs at 18:30 UTC (= 00:00 IST, midnight India time) — resets daily SMS counters on all devices
  cron.schedule('30 18 * * *', async () => {
    try {
      const result = await prisma.device.updateMany({ data: { smsSentToday: 0 } });
      console.log(`Daily reset: cleared smsSentToday for ${result.count} device(s)`);
    } catch (err) {
      console.error('Daily device reset error:', err);
    }
  });

  // Runs every 5 minutes — expire claimed payment tasks that have passed their expiresAt time
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await prisma.paymentTask.updateMany({
        where: {
          status: { in: ['CLAIMED', 'IN_PROGRESS'] },
          expiresAt: { lt: new Date() },
        },
        data: { status: 'EXPIRED', assignedToId: null, claimedAt: null },
      });
      if (result.count > 0) {
        console.log(`Payment task expiry: expired ${result.count} task(s)`);
      }
    } catch (err) {
      console.error('Payment task expiry error:', err);
    }
  });
};

module.exports = { startStaleTaskCleanup };
