const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');

// Public — no auth needed
const getAppVersion = async (req, res) => {
  try {
    const version = await prisma.appVersion.findUnique({
      where: { id: 'current' },
    });

    if (!version) {
      return successResponse(res, {
        latestVersion: '1.0.0',
        minVersion: '1.0.0',
        apkUrl: '',
        releaseNotes: '',
        forceUpdate: false,
      });
    }

    return successResponse(res, version);
  } catch (err) {
    console.error('getAppVersion error:', err);
    return errorResponse(res, 'Failed to get app version', 'SERVER_ERROR', 500);
  }
};

// Admin only — update version info
const updateAppVersion = async (req, res) => {
  try {
    const { latestVersion, minVersion, apkUrl, releaseNotes, forceUpdate } = req.body;

    if (!latestVersion || !minVersion || !apkUrl) {
      return errorResponse(res, 'latestVersion, minVersion, and apkUrl are required', 'VALIDATION_ERROR', 422);
    }

    const version = await prisma.appVersion.upsert({
      where: { id: 'current' },
      update: {
        latestVersion,
        minVersion,
        apkUrl,
        releaseNotes: releaseNotes || '',
        forceUpdate: forceUpdate ?? false,
      },
      create: {
        id: 'current',
        latestVersion,
        minVersion,
        apkUrl,
        releaseNotes: releaseNotes || '',
        forceUpdate: forceUpdate ?? false,
      },
    });

    return successResponse(res, version);
  } catch (err) {
    console.error('updateAppVersion error:', err);
    return errorResponse(res, 'Failed to update app version', 'SERVER_ERROR', 500);
  }
};

module.exports = { getAppVersion, updateAppVersion };
