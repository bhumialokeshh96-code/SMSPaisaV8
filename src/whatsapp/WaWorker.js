'use strict';

/**
 * WaWorker.js
 *
 * Background worker that processes pending WhatsApp tasks.
 * Runs on a fixed interval, picks up PENDING tasks, round-robin assigns them
 * to connected users, sends messages via Baileys, and updates the database.
 */

const prisma = require('../config/database');
const { socketMap } = require('./WaManager');
const { emitWaProgressUpdate } = require('../websocket/socketHandler');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Payout credited to a user's wallet per successfully sent WhatsApp message */
const WA_PAYOUT_PER_MESSAGE = 0.20;

/** Maximum number of PENDING tasks fetched and processed per worker cycle */
const BATCH_SIZE = 50;

/** How often (ms) the worker polls for new tasks */
const INTERVAL_MS = 10_000;

/** Artificial delay (ms) between individual message sends to reduce ban risk */
const SEND_DELAY_MS = 5_000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Persistent round-robin index across worker cycles for fair distribution */
let roundRobinIndex = 0;

/** Interval handle – stored so the worker can be stopped gracefully */
let intervalId = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a recipient phone number to a WhatsApp JID.
 * Strips non-digits and appends the required @s.whatsapp.net suffix.
 *
 * @param {string} recipient - Raw phone number from the task record
 * @returns {string} e.g. "919876543210@s.whatsapp.net"
 */
function formatJid(recipient) {
  const digits = String(recipient).replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

// ---------------------------------------------------------------------------
// Core worker loop
// ---------------------------------------------------------------------------

/**
 * One iteration of the worker loop.
 * Fetches a batch of PENDING tasks, distributes them across CONNECTED users,
 * sends each message, and updates task status and wallet balance.
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance for live updates
 */
async function processWaTasks(io) {
  try {
    const pendingTasks = await prisma.whatsappTask.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (!pendingTasks.length) return;

    const connectedUsers = await prisma.user.findMany({
      where: { whatsappStatus: 'CONNECTED' },
      select: { id: true },
    });

    if (!connectedUsers.length) {
      console.log('[WaWorker] No connected WhatsApp users – skipping batch.');
      return;
    }

    for (let i = 0; i < pendingTasks.length; i++) {
      const task = pendingTasks[i];

      // Persistent round-robin: pick next available user across cycles
      const assignedUser = connectedUsers[roundRobinIndex % connectedUsers.length];
      roundRobinIndex = (roundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;
      const userId = assignedUser.id;

      const sock = socketMap.get(userId);
      if (!sock) {
        // Socket not in memory (e.g. server just restarted); skip – task stays
        // PENDING and will be retried in the next worker cycle once the user
        // reconnects and their session is restored.
        continue;
      }

      try {
        const jid = formatJid(task.recipient);
        await sock.sendMessage(jid, { text: task.message });

        // Mark task as sent and record which user sent it
        await prisma.whatsappTask.update({
          where: { id: task.id },
          data: { status: 'SENT', assignedTo: userId },
        });

        // Credit the user's WhatsApp wallet balance
        await prisma.wallet.upsert({
          where: { userId },
          update: {
            waTotalEarned: { increment: WA_PAYOUT_PER_MESSAGE },
            waCurrentBalance: { increment: WA_PAYOUT_PER_MESSAGE },
          },
          create: {
            userId,
            waTotalEarned: WA_PAYOUT_PER_MESSAGE,
            waCurrentBalance: WA_PAYOUT_PER_MESSAGE,
          },
        });

        // Push live progress update to the user's Android app
        if (io) {
          const wallet = await prisma.wallet.findUnique({ where: { userId } });
          emitWaProgressUpdate(io, userId, {
            taskId: task.id,
            status: 'SENT',
            waTotalEarned: parseFloat(wallet?.waTotalEarned ?? 0),
            waCurrentBalance: parseFloat(wallet?.waCurrentBalance ?? 0),
          });
        }
      } catch (err) {
        console.error(`[WaWorker] Failed to send task ${task.id} via user ${userId}:`, err.message);
        await prisma.whatsappTask.update({
          where: { id: task.id },
          data: { status: 'FAILED', assignedTo: userId },
        });
      }

      // Anti-ban: pause between sends to avoid rate-limiting by Meta.
      // Skip the delay after the final message in the batch.
      if (i < pendingTasks.length - 1) {
        await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
      }
    }
  } catch (err) {
    console.error('[WaWorker] Unexpected error in processWaTasks:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the background worker.
 * Call once during server initialisation, passing the Socket.IO instance so
 * the worker can emit live progress events to connected users.
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
function start(io) {
  if (intervalId !== null) return; // Prevent double-start
  console.log('[WaWorker] Background WhatsApp task worker started.');
  intervalId = setInterval(() => processWaTasks(io), INTERVAL_MS);
}

/**
 * Stop the background worker gracefully.
 * Clears the interval so no new cycles are started.
 */
function stop() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[WaWorker] Background WhatsApp task worker stopped.');
  }
}

module.exports = { start, stop };
