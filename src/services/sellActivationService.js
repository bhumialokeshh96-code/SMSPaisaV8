const prisma = require('../config/database');

/**
 * Check if user is eligible for sell activation.
 * Requires at least 1 completed payment task.
 */
const checkSellEligibility = async (userId) => {
  const completedTask = await prisma.paymentTask.findFirst({
    where: { assignedToId: userId, status: 'COMPLETED' },
  });
  return !!completedTask;
};

/**
 * Activate sell (withdraw-opening) for a user.
 */
const activateSell = async (userId) => {
  const eligible = await checkSellEligibility(userId);
  if (!eligible) {
    throw new Error('Complete at least one payment task to activate sell');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { isSellActive: true, sellActivatedAt: new Date() },
  });
};

module.exports = { checkSellEligibility, activateSell };
