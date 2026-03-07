const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');
const { claimNewbieReward } = require('../services/newbieRewardService');

const getBalance = async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 'NOT_FOUND', 404);
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });

    return successResponse(res, {
      balance: parseFloat(wallet.balance),
      reward: parseFloat(wallet.reward),
      pending: parseFloat(wallet.pending),
      totalEarned: parseFloat(wallet.totalEarned),
      totalWithdrawn: parseFloat(wallet.totalWithdrawn),
      cashbackRate: parseFloat(settings?.cashbackDisplayRate ?? 4.5),
    });
  } catch (err) {
    console.error('getBalance error:', err);
    return errorResponse(res, 'Failed to get balance', 'SERVER_ERROR', 500);
  }
};

const getTransactions = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);
    const { type, status } = req.query;

    const where = { userId: req.user.id };
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    return successResponse(res, transactions);
  } catch (err) {
    console.error('getTransactions error:', err);
    return errorResponse(res, 'Failed to get transactions', 'SERVER_ERROR', 500);
  }
};

const getPaymentAccounts = async (req, res) => {
  try {
    const accounts = await prisma.paymentAccount.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, accounts);
  } catch (err) {
    console.error('getPaymentAccounts error:', err);
    return errorResponse(res, 'Failed to get payment accounts', 'SERVER_ERROR', 500);
  }
};

const claimNewbieRewardHandler = async (req, res) => {
  try {
    await claimNewbieReward(req.user.id);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    return successResponse(res, {
      message: 'Newbie reward claimed successfully!',
      balance: parseFloat(wallet.balance),
      reward: parseFloat(wallet.reward),
    });
  } catch (err) {
    if (err.message.includes('Complete') || err.message.includes('already claimed') || err.message.includes('not found')) {
      return errorResponse(res, err.message, 'NOT_ELIGIBLE', 400);
    }
    console.error('claimNewbieReward error:', err);
    return errorResponse(res, 'Failed to claim reward', 'SERVER_ERROR', 500);
  }
};

module.exports = { getBalance, getTransactions, getPaymentAccounts, claimNewbieRewardHandler };
