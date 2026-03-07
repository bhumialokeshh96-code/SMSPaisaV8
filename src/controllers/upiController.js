const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');

// GET /api/upi/list
const listUpiAccounts = async (req, res) => {
  try {
    const accounts = await prisma.userUpiAccount.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, accounts);
  } catch (err) {
    console.error('listUpiAccounts error:', err);
    return errorResponse(res, 'Failed to list UPI accounts', 'SERVER_ERROR', 500);
  }
};

// POST /api/upi/add
const addUpiAccount = async (req, res) => {
  try {
    const { upiId, upiType = 'UPI', paymentAppName, limitMin, limitMax } = req.body;

    const account = await prisma.userUpiAccount.create({
      data: {
        userId: req.user.id,
        upiType,
        upiId,
        paymentAppName,
        limitMin: limitMin ?? 10,
        limitMax: limitMax ?? 100000,
      },
    });

    return successResponse(res, account, 201);
  } catch (err) {
    console.error('addUpiAccount error:', err);
    return errorResponse(res, 'Failed to add UPI account', 'SERVER_ERROR', 500);
  }
};

// PUT /api/upi/:id/update
const updateUpiAccount = async (req, res) => {
  try {
    const account = await prisma.userUpiAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return errorResponse(res, 'UPI account not found', 'NOT_FOUND', 404);
    if (account.userId !== req.user.id) return errorResponse(res, 'Forbidden', 'FORBIDDEN', 403);

    const { upiId, paymentAppName, limitMin, limitMax, isDefault } = req.body;

    const updated = await prisma.userUpiAccount.update({
      where: { id: req.params.id },
      data: { upiId, paymentAppName, limitMin, limitMax, isDefault },
    });

    return successResponse(res, updated);
  } catch (err) {
    console.error('updateUpiAccount error:', err);
    return errorResponse(res, 'Failed to update UPI account', 'SERVER_ERROR', 500);
  }
};

// DELETE /api/upi/:id/remove
const removeUpiAccount = async (req, res) => {
  try {
    const account = await prisma.userUpiAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return errorResponse(res, 'UPI account not found', 'NOT_FOUND', 404);
    if (account.userId !== req.user.id) return errorResponse(res, 'Forbidden', 'FORBIDDEN', 403);

    await prisma.userUpiAccount.delete({ where: { id: req.params.id } });
    return successResponse(res, { message: 'UPI account removed' });
  } catch (err) {
    console.error('removeUpiAccount error:', err);
    return errorResponse(res, 'Failed to remove UPI account', 'SERVER_ERROR', 500);
  }
};

module.exports = { listUpiAccounts, addUpiAccount, updateUpiAccount, removeUpiAccount };
