const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');
const { incrementRewardProgress } = require('../services/newbieRewardService');

// GET /api/tasks/available
const getAvailableTasks = async (req, res) => {
  try {
    const { min, max, sort = 'desc', page, limit } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);

    const where = { status: 'PENDING' };
    if (min || max) {
      where.amount = {};
      if (min) where.amount.gte = parseFloat(min);
      if (max) where.amount.lte = parseFloat(max);
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
    const cashbackRate = settings?.cashbackDisplayRate ?? 4.5;
    const warningMessage = settings?.paymentWarningMessage ?? '';

    const [tasks, total] = await Promise.all([
      prisma.paymentTask.findMany({
        where,
        orderBy: { amount: sort === 'asc' ? 'asc' : 'desc' },
        skip,
        take,
      }),
      prisma.paymentTask.count({ where }),
    ]);

    return successResponse(res, {
      cashbackRate,
      warningMessage,
      tasks,
      pagination: paginationMeta(total, p, l),
    });
  } catch (err) {
    console.error('getAvailableTasks error:', err);
    return errorResponse(res, 'Failed to get tasks', 'SERVER_ERROR', 500);
  }
};

// POST /api/tasks/:id/claim
const claimTask = async (req, res) => {
  try {
    const task = await prisma.paymentTask.findUnique({ where: { id: req.params.id } });
    if (!task) return errorResponse(res, 'Task not found', 'NOT_FOUND', 404);
    if (task.status !== 'PENDING') return errorResponse(res, 'Task is not available', 'CONFLICT', 409);

    // Check user doesn't already have an active task
    const activeTask = await prisma.paymentTask.findFirst({
      where: { assignedToId: req.user.id, status: { in: ['CLAIMED', 'IN_PROGRESS', 'PROOF_UPLOADED'] } },
    });
    if (activeTask) {
      return errorResponse(res, 'You already have an active task. Complete it first.', 'CONFLICT', 409);
    }

    const updated = await prisma.paymentTask.update({
      where: { id: req.params.id },
      data: {
        status: 'CLAIMED',
        assignedToId: req.user.id,
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min to complete
      },
    });

    // Move commission to pending wallet
    await prisma.wallet.update({
      where: { userId: req.user.id },
      data: { pending: { increment: updated.commissionAmount } },
    });

    return successResponse(res, updated);
  } catch (err) {
    console.error('claimTask error:', err);
    return errorResponse(res, 'Failed to claim task', 'SERVER_ERROR', 500);
  }
};

// POST /api/tasks/:id/upload-proof
const uploadProof = async (req, res) => {
  try {
    const { screenshotUrl, transactionId, notes } = req.body;

    const task = await prisma.paymentTask.findUnique({ where: { id: req.params.id } });
    if (!task) return errorResponse(res, 'Task not found', 'NOT_FOUND', 404);
    if (task.assignedToId !== req.user.id) return errorResponse(res, 'Not your task', 'FORBIDDEN', 403);
    if (!['CLAIMED', 'IN_PROGRESS'].includes(task.status)) {
      return errorResponse(res, 'Task is not in a claimable state', 'CONFLICT', 409);
    }

    const [updatedTask, proof] = await prisma.$transaction([
      prisma.paymentTask.update({
        where: { id: req.params.id },
        data: { status: 'PROOF_UPLOADED' },
      }),
      prisma.taskProof.create({
        data: {
          taskId: req.params.id,
          userId: req.user.id,
          screenshotUrl,
          transactionId,
          notes,
        },
      }),
    ]);

    return successResponse(res, { task: updatedTask, proof });
  } catch (err) {
    console.error('uploadProof error:', err);
    return errorResponse(res, 'Failed to upload proof', 'SERVER_ERROR', 500);
  }
};

// GET /api/tasks/my-tasks
const getMyTasks = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);

    const where = { assignedToId: req.user.id };
    if (status) where.status = status;

    const [tasks, total] = await Promise.all([
      prisma.paymentTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { proofs: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      prisma.paymentTask.count({ where }),
    ]);

    return successResponse(res, { tasks, pagination: paginationMeta(total, p, l) });
  } catch (err) {
    console.error('getMyTasks error:', err);
    return errorResponse(res, 'Failed to get tasks', 'SERVER_ERROR', 500);
  }
};

// GET /api/tasks/history
const getTaskHistory = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);

    const where = { assignedToId: req.user.id, status: { in: ['COMPLETED', 'FAILED', 'EXPIRED', 'VERIFIED'] } };

    const [tasks, total] = await Promise.all([
      prisma.paymentTask.findMany({
        where,
        orderBy: { completedAt: 'desc' },
        skip,
        take,
      }),
      prisma.paymentTask.count({ where }),
    ]);

    return successResponse(res, { tasks, pagination: paginationMeta(total, p, l) });
  } catch (err) {
    console.error('getTaskHistory error:', err);
    return errorResponse(res, 'Failed to get task history', 'SERVER_ERROR', 500);
  }
};

module.exports = { getAvailableTasks, claimTask, uploadProof, getMyTasks, getTaskHistory };
