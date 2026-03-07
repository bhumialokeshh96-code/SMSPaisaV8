const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
    ]);

    return successResponse(res, { notifications, pagination: paginationMeta(total, p, l) });
  } catch (err) {
    console.error('getNotifications error:', err);
    return errorResponse(res, 'Failed to get notifications', 'SERVER_ERROR', 500);
  }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return errorResponse(res, 'Notification not found', 'NOT_FOUND', 404);
    if (notification.userId !== req.user.id) return errorResponse(res, 'Forbidden', 'FORBIDDEN', 403);

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    return successResponse(res, updated);
  } catch (err) {
    console.error('markRead error:', err);
    return errorResponse(res, 'Failed to mark notification', 'SERVER_ERROR', 500);
  }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    return successResponse(res, { message: 'All notifications marked as read' });
  } catch (err) {
    console.error('markAllRead error:', err);
    return errorResponse(res, 'Failed to mark notifications', 'SERVER_ERROR', 500);
  }
};

module.exports = { getNotifications, markRead, markAllRead };
