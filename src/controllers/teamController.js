const prisma = require('../config/database');
const { successResponse, errorResponse, paginate, paginationMeta } = require('../utils/helpers');

// GET /api/team/stats
const getTeamStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referred: { include: { wallet: true } } },
    });

    const memberIds = referrals.map((r) => r.referredId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      myTotalCommissions,
      commissionsToday,
      commissionsYesterday,
      newMembersToday,
      newMembersYesterday,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: { in: ['COMMISSION', 'REFERRAL_BONUS'] }, status: 'COMPLETED' },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: { in: ['COMMISSION', 'REFERRAL_BONUS'] }, status: 'COMPLETED', createdAt: { gte: today } },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          userId,
          type: { in: ['COMMISSION', 'REFERRAL_BONUS'] },
          status: 'COMPLETED',
          createdAt: { gte: yesterday, lt: today },
        },
      }),
      prisma.referral.count({ where: { referrerId: userId, createdAt: { gte: today } } }),
      prisma.referral.count({ where: { referrerId: userId, createdAt: { gte: yesterday, lt: today } } }),
    ]);

    const totalTeamDeposit = referrals.reduce((sum, r) => {
      return sum + parseFloat(r.referred?.wallet?.totalEarned || 0);
    }, 0);

    return successResponse(res, {
      myTotalCommissions: parseFloat(myTotalCommissions._sum.amount || 0),
      commissionsToday: parseFloat(commissionsToday._sum.amount || 0),
      commissionsYesterday: parseFloat(commissionsYesterday._sum.amount || 0),
      totalTeamMembers: referrals.length,
      totalTeamDeposit,
      newMembersToday,
      newMembersYesterday,
    });
  } catch (err) {
    console.error('getTeamStats error:', err);
    return errorResponse(res, 'Failed to get team stats', 'SERVER_ERROR', 500);
  }
};

// GET /api/team/invitation
const getInvitation = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { referralCode: true },
    });

    const baseUrl = process.env.APP_BASE_URL || 'https://paytaskr.app';
    return successResponse(res, {
      referralCode: user.referralCode,
      invitationLink: `${baseUrl}/register?ref=${user.referralCode}`,
    });
  } catch (err) {
    console.error('getInvitation error:', err);
    return errorResponse(res, 'Failed to get invitation', 'SERVER_ERROR', 500);
  }
};

// GET /api/team/members
const getTeamMembers = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where: { referrerId: req.user.id },
        include: {
          referred: {
            select: {
              id: true,
              phone: true,
              name: true,
              createdAt: true,
              wallet: { select: { balance: true, totalEarned: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.referral.count({ where: { referrerId: req.user.id } }),
    ]);

    return successResponse(res, {
      members: referrals.map((r) => ({ ...r.referred, level: r.level, joinedAt: r.createdAt })),
      pagination: paginationMeta(total, p, l),
    });
  } catch (err) {
    console.error('getTeamMembers error:', err);
    return errorResponse(res, 'Failed to get team members', 'SERVER_ERROR', 500);
  }
};

// GET /api/team/commissions
const getTeamCommissions = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user.id, type: 'REFERRAL_BONUS', status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where: { userId: req.user.id, type: 'REFERRAL_BONUS', status: 'COMPLETED' } }),
    ]);

    return successResponse(res, { commissions: transactions, pagination: paginationMeta(total, p, l) });
  } catch (err) {
    console.error('getTeamCommissions error:', err);
    return errorResponse(res, 'Failed to get team commissions', 'SERVER_ERROR', 500);
  }
};

module.exports = { getTeamStats, getInvitation, getTeamMembers, getTeamCommissions };
