const { v4: uuidv4 } = require('uuid');

const generateReferralCode = () => {
  return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
};

const paginate = (page = 1, limit = 20) => {
  const maxLimit = 100;
  const parsedLimit = Math.min(parseInt(limit) || 20, maxLimit);
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const skip = (parsedPage - 1) * parsedLimit;
  return { skip, take: parsedLimit, page: parsedPage, limit: parsedLimit };
};

const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  hasMore: page * limit < total,
  totalPages: Math.ceil(total / limit),
});

const successResponse = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data });
};

const errorResponse = (res, message, code = 'ERROR', statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error: { message, code } });
};

const isWithinActiveHours = (startTime, endTime) => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

module.exports = {
  generateReferralCode,
  paginate,
  paginationMeta,
  successResponse,
  errorResponse,
  isWithinActiveHours,
};
