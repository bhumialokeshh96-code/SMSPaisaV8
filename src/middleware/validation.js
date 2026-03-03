const Joi = require('joi');
const { errorResponse } = require('../utils/helpers');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message).join(', ');
      return errorResponse(res, messages, 'VALIDATION_ERROR', 422);
    }
    req[source] = value;
    next();
  };
};

const schemas = {
  register: Joi.object({
    phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).required(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(8).required(),
    deviceId: Joi.string().required(),
  }),

  login: Joi.object({
    phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
  }),

  reportStatus: Joi.object({
    taskId: Joi.string().uuid().required(),
    status: Joi.string().valid('SENT', 'DELIVERED', 'FAILED').required(),
    deviceId: Joi.string().required(),
    errorMessage: Joi.string().optional().allow(null, ''),
  }),

  requestWithdrawal: Joi.object({
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string().valid('UPI', 'BANK').required(),
    paymentDetails: Joi.object().required(),
  }),

  registerDevice: Joi.object({
    deviceName: Joi.string().required(),
    deviceId: Joi.string().required(),
    simInfo: Joi.object().optional(),
  }),

  updateDevice: Joi.object({
    deviceId: Joi.string().required(),
    dailyLimit: Joi.number().integer().min(1).max(1000).optional(),
    activeHoursStart: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    activeHoursEnd: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    simInfo: Joi.object().optional(),
  }),

  heartbeat: Joi.object({
    deviceId: Joi.string().required(),
    isOnline: Joi.boolean().optional(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
  }),

  applyReferral: Joi.object({
    referralCode: Joi.string().required(),
  }),

  changeUserRole: Joi.object({
    role: Joi.string().valid('ADMIN', 'USER').required(),
  }),

  createTask: Joi.object({
    recipient: Joi.string().required(),
    message: Joi.string().required(),
    clientId: Joi.string().required(),
    priority: Joi.number().integer().min(0).default(0),
  }),

  bulkCreateTask: Joi.object({
    tasks: Joi.array().items(
      Joi.object({
        recipient: Joi.string().required(),
        message: Joi.string().required(),
        clientId: Joi.string().required(),
        priority: Joi.number().integer().min(0).default(0),
      })
    ).min(1).required(),
  }),

  assignTask: Joi.object({
    recipient: Joi.string().required(),
    message: Joi.string().required(),
    clientId: Joi.string().required(),
    priority: Joi.number().integer().min(0).default(0),
    userId: Joi.string().uuid().required(),
  }),

  updateSettings: Joi.object({
    perRoundSendLimit: Joi.number().integer().min(1).max(100).required(),
  }),

  updateTaskStatus: Joi.object({
    status: Joi.string().valid('SENT', 'DELIVERED', 'FAILED').required(),
  }),

  forgotPassword: Joi.object({
    phone: Joi.string().required(),
    deviceId: Joi.string().required(),
  }),

  resetPassword: Joi.object({
    resetToken: Joi.string().uuid().required(),
    newPassword: Joi.string().min(6).required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
  }),
};

module.exports = { validate, schemas };
