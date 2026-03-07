const prisma = require('../config/database');

/**
 * Calculate commission amount: amount × commissionRate / 100
 */
const calculateCommission = (amount, commissionRate) => {
  return Math.round(parseFloat(amount) * parseFloat(commissionRate)) / 100;
};

/**
 * Credit commission to user wallet after task is verified.
 * Also increments totalCollection on the user record.
 */
const creditCommission = async (userId, taskId, taskAmount, commissionAmount) => {
  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: {
        balance: { increment: commissionAmount },
        totalEarned: { increment: commissionAmount },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { totalCollection: { increment: taskAmount } },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: 'COMMISSION',
        amount: commissionAmount,
        status: 'COMPLETED',
        description: `Commission ∫${commissionAmount} for payment task ${taskId} (amount: ∫${taskAmount})`,
        relatedTaskId: taskId,
      },
    });

    return { wallet, transaction };
  });
};

/**
 * Credit referrer commission when their team member completes a task.
 */
const creditReferralCommission = async (referrerId, amount, commissionRate, taskId) => {
  const referralCommission = calculateCommission(amount, commissionRate);
  if (referralCommission <= 0) return null;

  return await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: referrerId },
      data: {
        balance: { increment: referralCommission },
        totalEarned: { increment: referralCommission },
      },
    });

    return tx.transaction.create({
      data: {
        userId: referrerId,
        type: 'REFERRAL_BONUS',
        amount: referralCommission,
        status: 'COMPLETED',
        description: `Team commission ∫${referralCommission} from task ${taskId}`,
        relatedTaskId: taskId,
      },
    });
  });
};

module.exports = { calculateCommission, creditCommission, creditReferralCommission };
