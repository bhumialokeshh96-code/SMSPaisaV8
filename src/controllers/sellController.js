const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { checkSellEligibility, activateSell } = require('../services/sellActivationService');

// GET /api/sell/status
const getSellStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isSellActive: true, sellActivatedAt: true },
    });
    const eligible = await checkSellEligibility(req.user.id);
    return successResponse(res, { isSellActive: user.isSellActive, sellActivatedAt: user.sellActivatedAt, eligible });
  } catch (err) {
    console.error('getSellStatus error:', err);
    return errorResponse(res, 'Failed to get sell status', 'SERVER_ERROR', 500);
  }
};

// POST /api/sell/activate
const activateSellHandler = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isSellActive: true },
    });

    if (user.isSellActive) {
      return errorResponse(res, 'Sell is already activated', 'CONFLICT', 409);
    }

    const updated = await activateSell(req.user.id);
    return successResponse(res, { isSellActive: updated.isSellActive, sellActivatedAt: updated.sellActivatedAt });
  } catch (err) {
    if (err.message.includes('Complete at least')) {
      return errorResponse(res, err.message, 'NOT_ELIGIBLE', 400);
    }
    console.error('activateSell error:', err);
    return errorResponse(res, 'Failed to activate sell', 'SERVER_ERROR', 500);
  }
};

module.exports = { getSellStatus, activateSellHandler };
