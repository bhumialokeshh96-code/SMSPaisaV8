const prisma = require('../config/database');

/**
 * Create newbie reward record for a new user.
 * Reward of 350 iTokens is set in the Wallet.reward field.
 */
const createNewbieReward = async (userId) => {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  const rewardAmount = settings?.newbieRewardAmount ?? 350;
  const threshold = settings?.newbieRewardThreshold ?? 2000;

  await prisma.newbieReward.create({
    data: {
      userId,
      amount: rewardAmount,
      totalTransactionsRequired: threshold,
    },
  });

  // Credit reward into wallet's reward balance
  await prisma.wallet.update({
    where: { userId },
    data: { reward: { increment: rewardAmount } },
  });
};

/**
 * Check if user can claim newbie reward and process the claim.
 * Moves reward from wallet.reward → wallet.balance after threshold is met.
 */
const claimNewbieReward = async (userId) => {
  const reward = await prisma.newbieReward.findUnique({ where: { userId } });
  if (!reward) throw new Error('Newbie reward record not found');
  if (reward.isClaimed) throw new Error('Reward already claimed');

  if (parseFloat(reward.currentTransactionTotal) < parseFloat(reward.totalTransactionsRequired)) {
    throw new Error(
      `Complete ₹${reward.totalTransactionsRequired} in transactions to claim. Current: ₹${reward.currentTransactionTotal}`
    );
  }

  return await prisma.$transaction(async (tx) => {
    await tx.newbieReward.update({
      where: { userId },
      data: { isClaimed: true, claimedAt: new Date() },
    });

    await tx.wallet.update({
      where: { userId },
      data: {
        reward: { decrement: reward.amount },
        balance: { increment: reward.amount },
        totalEarned: { increment: reward.amount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'NEWBIE_REWARD',
        amount: reward.amount,
        status: 'COMPLETED',
        description: `Newbie reward of ∫${reward.amount} claimed`,
      },
    });

    return reward;
  });
};

/**
 * Increment newbie reward progress when a payment task is completed.
 */
const incrementRewardProgress = async (userId, amount) => {
  await prisma.newbieReward.updateMany({
    where: { userId, isClaimed: false },
    data: { currentTransactionTotal: { increment: amount } },
  });
};

module.exports = { createNewbieReward, claimNewbieReward, incrementRewardProgress };
