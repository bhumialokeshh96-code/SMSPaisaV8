const prisma = require('../config/database');
const constants = require('../utils/constants');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');

const requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails } = req.body;

    if (amount < constants.MIN_WITHDRAWAL_AMOUNT) {
      return errorResponse(res, `Minimum withdrawal amount is ₹${constants.MIN_WITHDRAWAL_AMOUNT}`, 'VALIDATION_ERROR', 422);
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet || parseFloat(wallet.balance) < amount) {
      return errorResponse(res, 'Insufficient balance', 'INSUFFICIENT_BALANCE', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyWithdrawals = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        userId: req.user.id,
        type: 'WITHDRAWAL',
        status: { in: ['PENDING', 'COMPLETED'] },
        createdAt: { gte: today },
      },
    });

    const dailyTotal = parseFloat(dailyWithdrawals._sum.amount || 0);
    if (dailyTotal + amount > constants.MAX_WITHDRAWAL_PER_DAY) {
      return errorResponse(res, `Daily withdrawal limit of ₹${constants.MAX_WITHDRAWAL_PER_DAY} exceeded`, 'LIMIT_EXCEEDED', 400);
    }

    const transaction = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId: req.user.id },
        data: {
          balance: { decrement: amount },
          totalWithdrawn: { increment: amount },
        },
      });

      return tx.transaction.create({
        data: {
          userId: req.user.id,
          type: 'WITHDRAWAL',
          amount,
          status: 'PENDING',
          paymentMethod,
          paymentDetails,
          description: `Withdrawal via ${paymentMethod} — pending admin approval`,
        },
      });
    });

    return successResponse(res, transaction, 201);
  } catch (err) {
    console.error('requestWithdrawal error:', err);
    return errorResponse(res, 'Failed to process withdrawal', 'SERVER_ERROR', 500);
  }
};

const getWithdrawalHistory = async (req, res) => {
  try {
    const { page, limit, skip, take } = paginate(req.query.page, req.query.limit);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user.id, type: 'WITHDRAWAL' },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where: { userId: req.user.id, type: 'WITHDRAWAL' } }),
    ]);

    return successResponse(res, transactions);
  } catch (err) {
    console.error('getWithdrawalHistory error:', err);
    return errorResponse(res, 'Failed to get withdrawal history', 'SERVER_ERROR', 500);
  }
};

const addUpi = async (req, res) => {
  try {
    const upiId = req.body.upi_id || req.body.upiId;
    const name = req.body.name || req.body.accountHolderName || '';
    if (!upiId) return errorResponse(res, 'upi_id is required', 'VALIDATION_ERROR', 422);

    const account = await prisma.paymentAccount.create({
      data: {
        userId: req.user.id,
        type: 'UPI',
        upiId,
        details: upiId,
        accountHolderName: name || null,
      },
    });

    return successResponse(res, account, 201);
  } catch (err) {
    console.error('addUpi error:', err);
    return errorResponse(res, 'Failed to save UPI ID', 'SERVER_ERROR', 500);
  }
};

const addBank = async (req, res) => {
  try {
    const accountNumber = req.body.account_number || req.body.accountNumber;
    const ifsc = req.body.ifsc_code || req.body.ifsc;
    const bankName = req.body.bank_name || req.body.bankName;
    const accountHolderName = req.body.account_holder_name || req.body.accountHolderName || '';

    if (!accountNumber || !ifsc || !bankName) {
      return errorResponse(res, 'accountNumber, ifsc, and bankName are required', 'VALIDATION_ERROR', 422);
    }

    const last4 = accountNumber.substring(Math.max(0, accountNumber.length - 4));
    const details = `${bankName} - XXXX${last4}`;

    const account = await prisma.paymentAccount.create({
      data: {
        userId: req.user.id,
        type: 'BANK',
        accountNumber,
        ifsc,
        bankName,
        accountHolderName: accountHolderName || null,
        details,
      },
    });

    return successResponse(res, account, 201);
  } catch (err) {
    console.error('addBank error:', err);
    return errorResponse(res, 'Failed to save bank details', 'SERVER_ERROR', 500);
  }
};

module.exports = { requestWithdrawal, getWithdrawalHistory, addUpi, addBank };
