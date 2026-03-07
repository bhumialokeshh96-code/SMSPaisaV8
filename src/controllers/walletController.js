const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');

const getBalance = async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 'NOT_FOUND', 404);
    }
    return successResponse(res, wallet);
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

module.exports = { getBalance, getTransactions, getPaymentAccounts };
