const prisma = require('../config/database');
const constants = require('../utils/constants');

const creditEarning = async (userId, taskId, amount) => {
  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: 'EARNING',
        amount,
        status: 'COMPLETED',
        description: `SMS delivery earning for task ${taskId}`,
      },
    });

    return { wallet, transaction };
  });
};

const creditReferralBonus = async (referrerId, referredId, referralId) => {
  return await prisma.$transaction(async (tx) => {
    const referrerBonus = constants.REFERRAL_BONUS_REFERRER;
    const referredBonus = constants.REFERRAL_BONUS_REFERRED;

    await tx.wallet.update({
      where: { userId: referrerId },
      data: {
        balance: { increment: referrerBonus },
        totalEarned: { increment: referrerBonus },
      },
    });

    await tx.transaction.create({
      data: {
        userId: referrerId,
        type: 'REFERRAL_BONUS',
        amount: referrerBonus,
        status: 'COMPLETED',
        description: `Referral bonus for referring user ${referredId}`,
      },
    });

    await tx.wallet.update({
      where: { userId: referredId },
      data: {
        balance: { increment: referredBonus },
        totalEarned: { increment: referredBonus },
      },
    });

    await tx.transaction.create({
      data: {
        userId: referredId,
        type: 'REFERRAL_BONUS',
        amount: referredBonus,
        status: 'COMPLETED',
        description: 'Referral signup bonus',
      },
    });

    await tx.referral.update({
      where: { id: referralId },
      data: { bonusPaid: true },
    });

    const referrerWallet = await tx.wallet.findUnique({ where: { userId: referrerId } });
    const referredWallet = await tx.wallet.findUnique({ where: { userId: referredId } });
    return { referrerWallet, referredWallet };
  });
};

const checkAndPayReferralBonus = async (userId, emitFn = null) => {
  const referral = await prisma.referral.findUnique({
    where: { referredId: userId },
    include: { referrer: true },
  });

  if (!referral || referral.bonusPaid) return;

  const smsCount = await prisma.smsLog.count({
    where: { userId, status: { in: ['SENT', 'DELIVERED'] } },
  });

  if (smsCount >= constants.REFERRAL_QUALIFYING_SMS) {
    const result = await creditReferralBonus(referral.referrerId, userId, referral.id);
    if (emitFn && result) {
      if (result.referrerWallet) emitFn(referral.referrerId, parseFloat(result.referrerWallet.balance));
      if (result.referredWallet) emitFn(userId, parseFloat(result.referredWallet.balance));
    }
  }
};

module.exports = { creditEarning, creditReferralBonus, checkAndPayReferralBonus };
