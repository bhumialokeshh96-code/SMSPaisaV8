const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');

const getOverview = async (req, res) => {
  try {
    const [wallet, totalSmsSent, totalDelivered, activeDevices] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId: req.user.id } }),
      prisma.smsLog.count({ where: { userId: req.user.id } }),
      prisma.smsLog.count({ where: { userId: req.user.id, status: 'DELIVERED' } }),
      prisma.device.count({ where: { userId: req.user.id, isOnline: true } }),
    ]);

    const successRate = totalSmsSent > 0 ? totalDelivered / totalSmsSent : 0;

    return successResponse(res, {
      totalSmsSent,
      totalEarnings: parseFloat(wallet?.totalEarned) || 0,
      successRate,
      totalWithdrawn: parseFloat(wallet?.totalWithdrawn) || 0,
      availableBalance: parseFloat(wallet?.balance) || 0,
      activeDevices,
    });
  } catch (err) {
    console.error('getOverview error:', err);
    return errorResponse(res, 'Failed to get overview stats', 'SERVER_ERROR', 500);
  }
};

const getDailyStats = async (req, res) => {
  try {
    const dateStr = req.query.date;
    const date = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [sent, delivered, failed, earningsResult] = await Promise.all([
      prisma.smsLog.count({ where: { userId: req.user.id, createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.smsLog.count({ where: { userId: req.user.id, status: 'DELIVERED', createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.smsLog.count({ where: { userId: req.user.id, status: 'FAILED', createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.smsLog.aggregate({
        _sum: { amountEarned: true },
        where: { userId: req.user.id, status: 'DELIVERED', createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
    ]);

    return successResponse(res, {
      date: startOfDay.toISOString().split('T')[0],
      sent,
      delivered,
      failed,
      earnings: parseFloat(earningsResult._sum.amountEarned) || 0,
    });
  } catch (err) {
    console.error('getDailyStats error:', err);
    return errorResponse(res, 'Failed to get daily stats', 'SERVER_ERROR', 500);
  }
};

const getWeeklyStats = async (req, res) => {
  try {
    const weekStr = req.query.week;
    const refDate = weekStr ? new Date(weekStr) : new Date();
    const dayOfWeek = refDate.getDay();
    const startOfWeek = new Date(refDate);
    startOfWeek.setDate(refDate.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [sent, delivered, failed, earningsResult] = await Promise.all([
        prisma.smsLog.count({ where: { userId: req.user.id, createdAt: { gte: dayStart, lte: dayEnd } } }),
        prisma.smsLog.count({ where: { userId: req.user.id, status: 'DELIVERED', createdAt: { gte: dayStart, lte: dayEnd } } }),
        prisma.smsLog.count({ where: { userId: req.user.id, status: 'FAILED', createdAt: { gte: dayStart, lte: dayEnd } } }),
        prisma.smsLog.aggregate({
          _sum: { amountEarned: true },
          where: { userId: req.user.id, status: 'DELIVERED', createdAt: { gte: dayStart, lte: dayEnd } },
        }),
      ]);

      days.push({
        date: dayStart.toISOString().split('T')[0],
        sent,
        delivered,
        failed,
        earnings: parseFloat(earningsResult._sum.amountEarned) || 0,
      });
    }

    const totalSent = days.reduce((s, d) => s + d.sent, 0);
    const totalDelivered = days.reduce((s, d) => s + d.delivered, 0);
    const totalFailed = days.reduce((s, d) => s + d.failed, 0);
    const totalEarnings = days.reduce((s, d) => s + d.earnings, 0);

    return successResponse(res, {
      week: startOfWeek.toISOString().split('T')[0],
      totalSent,
      totalDelivered,
      totalFailed,
      totalEarnings,
      days,
    });
  } catch (err) {
    console.error('getWeeklyStats error:', err);
    return errorResponse(res, 'Failed to get weekly stats', 'SERVER_ERROR', 500);
  }
};

const getMonthlyStats = async (req, res) => {
  try {
    const monthStr = req.query.month;
    const refDate = monthStr ? new Date(monthStr) : new Date();
    const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const weeksData = [];
    let current = new Date(startOfMonth);
    while (current <= endOfMonth) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(current.getDate() + 6);
      if (weekEnd > endOfMonth) {
        weekEnd.setTime(endOfMonth.getTime());
      }

      const [sent, delivered, failed, earningsResult] = await Promise.all([
        prisma.smsLog.count({ where: { userId: req.user.id, createdAt: { gte: weekStart, lte: weekEnd } } }),
        prisma.smsLog.count({ where: { userId: req.user.id, status: 'DELIVERED', createdAt: { gte: weekStart, lte: weekEnd } } }),
        prisma.smsLog.count({ where: { userId: req.user.id, status: 'FAILED', createdAt: { gte: weekStart, lte: weekEnd } } }),
        prisma.smsLog.aggregate({
          _sum: { amountEarned: true },
          where: { userId: req.user.id, status: 'DELIVERED', createdAt: { gte: weekStart, lte: weekEnd } },
        }),
      ]);

      weeksData.push({
        week: weekStart.toISOString().split('T')[0],
        totalSent: sent,
        totalDelivered: delivered,
        totalFailed: failed,
        totalEarnings: parseFloat(earningsResult._sum.amountEarned) || 0,
        days: [],
      });

      current.setDate(current.getDate() + 7);
    }

    const totalSent = weeksData.reduce((s, w) => s + w.totalSent, 0);
    const totalDelivered = weeksData.reduce((s, w) => s + w.totalDelivered, 0);
    const totalFailed = weeksData.reduce((s, w) => s + w.totalFailed, 0);
    const totalEarnings = weeksData.reduce((s, w) => s + w.totalEarnings, 0);

    return successResponse(res, {
      month: `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`,
      totalSent,
      totalDelivered,
      totalFailed,
      totalEarnings,
      weeks: weeksData,
    });
  } catch (err) {
    console.error('getMonthlyStats error:', err);
    return errorResponse(res, 'Failed to get monthly stats', 'SERVER_ERROR', 500);
  }
};

module.exports = { getOverview, getDailyStats, getWeeklyStats, getMonthlyStats };
