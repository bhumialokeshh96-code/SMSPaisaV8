const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/helpers');

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  handler: (req, res) => {
    errorResponse(res, 'Too many requests, please try again after a minute', 'RATE_LIMIT_EXCEEDED', 429);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  handler: (req, res) => {
    errorResponse(res, 'Too many requests', 'RATE_LIMIT_EXCEEDED', 429);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const staticRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authRateLimit, apiRateLimit, staticRateLimit };
