const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const { getRedisClient } = require('../config/redis');
const { generateReferralCode, successResponse, errorResponse } = require('../utils/helpers');

const register = async (req, res) => {
  try {
    const { phone, email, password, deviceId } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return errorResponse(res, 'Phone number already registered', 'CONFLICT', 409);
    }

    const existingDevice = await prisma.device.findUnique({ where: { deviceId } });
    if (existingDevice) {
      return errorResponse(res, 'Device already registered', 'CONFLICT', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = generateReferralCode();

    const user = await prisma.user.create({
      data: {
        phone,
        email,
        password: hashedPassword,
        referralCode,
        wallet: { create: {} },
        devices: {
          create: {
            deviceId,
            deviceName: 'Android Device',
          },
        },
      },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    return successResponse(res, { token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, referralCode: user.referralCode, role: user.role, createdAt: user.createdAt } }, 201);
  } catch (err) {
    console.error('register error:', err);
    return errorResponse(res, 'Registration failed', 'SERVER_ERROR', 500);
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.password) {
      return errorResponse(res, 'Invalid phone or password', 'AUTH_ERROR', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid phone or password', 'AUTH_ERROR', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Account is inactive', 'AUTH_ERROR', 401);
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    return successResponse(res, { token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, referralCode: user.referralCode, role: user.role, createdAt: user.createdAt } });
  } catch (err) {
    console.error('login error:', err);
    return errorResponse(res, 'Login failed', 'SERVER_ERROR', 500);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { wallet: true },
    });
    return successResponse(res, user);
  } catch (err) {
    console.error('getMe error:', err);
    return errorResponse(res, 'Failed to fetch user', 'SERVER_ERROR', 500);
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, email },
    });
    return successResponse(res, user);
  } catch (err) {
    console.error('updateProfile error:', err);
    return errorResponse(res, 'Failed to update profile', 'SERVER_ERROR', 500);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { phone, deviceId } = req.body;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      return errorResponse(res, 'Invalid phone or device', 'AUTH_ERROR', 401);
    }

    const device = await prisma.device.findFirst({
      where: { deviceId, userId: user.id },
    });
    if (!device) {
      return errorResponse(res, 'Invalid phone or device', 'AUTH_ERROR', 401);
    }

    const resetToken = uuidv4();
    const redis = getRedisClient();
    await redis.setex(`pwd_reset:${resetToken}`, 900, user.id);

    return successResponse(res, { resetToken, expiresIn: 900 });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return errorResponse(res, 'Failed to process request', 'SERVER_ERROR', 500);
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    const redis = getRedisClient();
    const userId = await redis.get(`pwd_reset:${resetToken}`);

    if (!userId) {
      return errorResponse(res, 'Invalid or expired reset token', 'AUTH_ERROR', 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await redis.del(`pwd_reset:${resetToken}`);

    return successResponse(res, { message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return errorResponse(res, 'Failed to reset password', 'SERVER_ERROR', 500);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.password) {
      return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 'AUTH_ERROR', 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    return successResponse(res, { message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    return errorResponse(res, 'Failed to change password', 'SERVER_ERROR', 500);
  }
};

module.exports = { register, login, getMe, updateProfile, forgotPassword, resetPassword, changePassword };
