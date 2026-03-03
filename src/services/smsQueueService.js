const { getRedisClient } = require('../config/redis');

const SMS_QUEUE_KEY = 'sms:queue';
const SMS_ASSIGNED_KEY = 'sms:assigned';

const enqueueTask = async (taskId, priority = 0) => {
  const redis = getRedisClient();
  await redis.zadd(SMS_QUEUE_KEY, priority, taskId);
};

const dequeueTask = async () => {
  const redis = getRedisClient();
  const results = await redis.zpopmax(SMS_QUEUE_KEY, 1);
  if (!results || results.length === 0) return null;
  return results[0];
};

const markTaskAssigned = async (taskId, deviceId, timeoutSeconds = 60) => {
  const redis = getRedisClient();
  await redis.setex(`${SMS_ASSIGNED_KEY}:${taskId}`, timeoutSeconds, deviceId);
};

const isTaskAssigned = async (taskId) => {
  const redis = getRedisClient();
  const deviceId = await redis.get(`${SMS_ASSIGNED_KEY}:${taskId}`);
  return deviceId;
};

const removeAssignedTask = async (taskId) => {
  const redis = getRedisClient();
  await redis.del(`${SMS_ASSIGNED_KEY}:${taskId}`);
};

const getQueueLength = async () => {
  const redis = getRedisClient();
  return await redis.zcard(SMS_QUEUE_KEY);
};

module.exports = {
  enqueueTask,
  dequeueTask,
  markTaskAssigned,
  isTaskAssigned,
  removeAssignedTask,
  getQueueLength,
};
