const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');

const registerDevice = async (req, res) => {
  try {
    const { deviceName, deviceId, simInfo } = req.body;

    const existing = await prisma.device.findUnique({ where: { deviceId } });
    if (existing) {
      if (existing.userId !== req.user.id) {
        return errorResponse(res, 'Device already registered to another user', 'CONFLICT', 409);
      }
      const device = await prisma.device.update({
        where: { deviceId },
        data: { deviceName, simInfo, lastSeen: new Date() },
      });
      return successResponse(res, device);
    }

    const device = await prisma.device.create({
      data: {
        userId: req.user.id,
        deviceName,
        deviceId,
        simInfo,
        lastSeen: new Date(),
      },
    });

    return successResponse(res, device, 201);
  } catch (err) {
    console.error('registerDevice error:', err);
    return errorResponse(res, 'Failed to register device', 'SERVER_ERROR', 500);
  }
};

const updateDeviceSettings = async (req, res) => {
  try {
    const { deviceId, dailyLimit, activeHoursStart, activeHoursEnd, simInfo } = req.body;

    const device = await prisma.device.findFirst({
      where: { deviceId, userId: req.user.id },
    });
    if (!device) {
      return errorResponse(res, 'Device not found', 'NOT_FOUND', 404);
    }

    const updateData = {};
    if (dailyLimit !== undefined) updateData.dailyLimit = dailyLimit;
    if (activeHoursStart !== undefined) updateData.activeHoursStart = activeHoursStart;
    if (activeHoursEnd !== undefined) updateData.activeHoursEnd = activeHoursEnd;
    if (simInfo !== undefined) updateData.simInfo = simInfo;

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: updateData,
    });

    return successResponse(res, updated);
  } catch (err) {
    console.error('updateDeviceSettings error:', err);
    return errorResponse(res, 'Failed to update device settings', 'SERVER_ERROR', 500);
  }
};

const heartbeat = async (req, res) => {
  try {
    const { deviceId, isOnline = true } = req.body;

    const device = await prisma.device.findFirst({
      where: { deviceId, userId: req.user.id },
    });
    if (!device) {
      return errorResponse(res, 'Device not found', 'NOT_FOUND', 404);
    }

    await prisma.device.update({
      where: { id: device.id },
      data: { isOnline, lastSeen: new Date() },
    });

    return successResponse(res, { message: 'Heartbeat received', deviceId, isOnline });
  } catch (err) {
    console.error('heartbeat error:', err);
    return errorResponse(res, 'Failed to process heartbeat', 'SERVER_ERROR', 500);
  }
};

const listDevices = async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, devices);
  } catch (err) {
    console.error('listDevices error:', err);
    return errorResponse(res, 'Failed to list devices', 'SERVER_ERROR', 500);
  }
};

module.exports = { registerDevice, updateDeviceSettings, heartbeat, listDevices };
