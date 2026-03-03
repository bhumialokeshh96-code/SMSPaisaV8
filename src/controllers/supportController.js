const { successResponse } = require('../utils/helpers');

const getSupportLinks = async (req, res) => {
  return successResponse(res, {
    telegram: process.env.SUPPORT_TELEGRAM_LINK || 'https://t.me/smspaisa_support',
    whatsapp: process.env.SUPPORT_WHATSAPP_LINK || 'https://wa.me/919000000000',
  });
};

module.exports = { getSupportLinks };
