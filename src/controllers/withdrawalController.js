const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const constants = require('../utils/constants');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');
const { createPayout } = require('../services/payoutService');

// POST /api/withdraw/request
const requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails, pin } = req.body;

    const minAmount = parseFloat(constants.MIN_WITHDRAWAL_AMOUNT);
    if (parseFloat(amount) < minAmount) {
      return errorResponse(res, `Minimum withdrawal amount is ∫${minAmount}`, 'VALIDATION_ERROR', 422);
    }

    // Verify PIN
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.isSellActive) {
      return errorResponse(res, 'Activate sell first to withdraw', 'NOT_ELIGIBLE', 400);
    }
    if (!user.pin) {
      return errorResponse(res, 'Set up your PIN before withdrawing', 'PIN_REQUIRED', 400);
    }
    const pinMatch = await bcrypt.compare(pin, user.pin);
    if (!pinMatch) {
      return errorResponse(res, 'Invalid PIN', 'AUTH_ERROR', 401);
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet || parseFloat(wallet.balance) < parseFloat(amount)) {
      return errorResponse(res, 'Insufficient balance', 'INSUFFICIENT_BALANCE', 400);
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyTotal = await prisma.withdrawal.aggregate({
      _sum: { amount: true },
      where: {
        userId: req.user.id,
        status: { in: ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED'] },
        createdAt: { gte: today },
      },
    });

    const maxPerDay = parseFloat(constants.MAX_WITHDRAWAL_PER_DAY);
    if (parseFloat(dailyTotal._sum.amount || 0) + parseFloat(amount) > maxPerDay) {
      return errorResponse(res, `Daily withdrawal limit of ∫${maxPerDay} exceeded`, 'LIMIT_EXCEEDED', 400);
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId: req.user.id },
        data: {
          balance: { decrement: amount },
          totalWithdrawn: { increment: amount },
        },
      });

      await tx.user.update({
        where: { id: req.user.id },
        data: { totalPayout: { increment: amount } },
      });

      return tx.withdrawal.create({
        data: {
          userId: req.user.id,
          amount,
          paymentMethod,
          paymentDetails,
          pinVerified: true,
          status: 'PENDING',
        },
      });
    });

    return successResponse(res, withdrawal, 201);
  } catch (err) {
    console.error('requestWithdrawal error:', err);
    return errorResponse(res, 'Failed to process withdrawal', 'SERVER_ERROR', 500);
  }
};

// GET /api/withdraw/history
const getWithdrawalHistory = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.withdrawal.count({ where: { userId: req.user.id } }),
    ]);

    return successResponse(res, { withdrawals, pagination: paginationMeta(total, p, l) });
  } catch (err) {
    console.error('getWithdrawalHistory error:', err);
    return errorResponse(res, 'Failed to get withdrawal history', 'SERVER_ERROR', 500);
  }
};

module.exports = { requestWithdrawal, getWithdrawalHistory };
