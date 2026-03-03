const prisma = require('../config/database');
const { generateReferralCode, successResponse, errorResponse } = require('../utils/helpers');
const constants = require('../utils/constants');

const getReferralCode = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { referralCode: true },
    });
    return successResponse(res, { referralCode: user.referralCode });
  } catch (err) {
    console.error('getReferralCode error:', err);
    return errorResponse(res, 'Failed to get referral code', 'SERVER_ERROR', 500);
  }
};

const applyReferral = async (req, res) => {
  try {
    const { referralCode } = req.body;

    const existingReferral = await prisma.referral.findUnique({
      where: { referredId: req.user.id },
    });
    if (existingReferral) {
      return errorResponse(res, 'Referral already applied', 'CONFLICT', 409);
    }

    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (!referrer) {
      return errorResponse(res, 'Invalid referral code', 'NOT_FOUND', 404);
    }
    if (referrer.id === req.user.id) {
      return errorResponse(res, 'Cannot use your own referral code', 'VALIDATION_ERROR', 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user.id },
        data: { referredById: referrer.id },
      });

      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: req.user.id,
          referrerBonus: constants.REFERRAL_BONUS_REFERRER,
          referredBonus: constants.REFERRAL_BONUS_REFERRED,
        },
      });
    });

    return successResponse(res, { message: 'Referral applied successfully' });
  } catch (err) {
    console.error('applyReferral error:', err);
    return errorResponse(res, 'Failed to apply referral', 'SERVER_ERROR', 500);
  }
};

const getReferralStats = async (req, res) => {
  try {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: req.user.id },
      include: { referred: { select: { phone: true, createdAt: true } } },
    });

    const totalReferrals = referrals.length;
    const paidReferrals = referrals.filter((r) => r.bonusPaid).length;
    const totalEarnings = referrals.filter((r) => r.bonusPaid).reduce((acc, r) => acc + parseFloat(r.referrerBonus), 0);

    const formattedReferrals = referrals.map((r) => ({
      id: r.id,
      name: r.referred?.phone ? `User ${r.referred.phone.slice(-4)}` : 'Unknown',
      joinedAt: r.referred?.createdAt ? new Date(r.referred.createdAt).toLocaleDateString('en-IN') : '',
      status: r.bonusPaid ? 'PAID' : 'PENDING',
      earnings: r.bonusPaid ? parseFloat(r.referrerBonus) : 0,
    }));

    return successResponse(res, {
      referralCode: (await prisma.user.findUnique({ where: { id: req.user.id }, select: { referralCode: true } })).referralCode,
      totalReferrals,
      activeReferrals: totalReferrals - paidReferrals,
      totalEarnings,
      referrals: formattedReferrals,
    });
  } catch (err) {
    console.error('getReferralStats error:', err);
    return errorResponse(res, 'Failed to get referral stats', 'SERVER_ERROR', 500);
  }
};

module.exports = { getReferralCode, applyReferral, getReferralStats };
