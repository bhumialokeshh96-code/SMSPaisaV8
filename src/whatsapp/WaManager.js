'use strict';

/**
 * WaManager.js
 *
 * Core Baileys WhatsApp socket manager.
 * Maintains a Map<userId, WASocket> for all active sessions and exposes
 * methods for pairing-code generation, session reconnection, and logout.
 */

const path = require('path');
const fs = require('fs');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const prisma = require('../config/database');

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/** Root directory where per-user session folders are stored */
const SESSION_ROOT = path.join(process.cwd(), 'wa_sessions');

/**
 * Delay (ms) before calling sock.requestPairingCode() after the socket is
 * created.  Baileys needs a brief moment to reach the pre-auth connection
 * state before the pairing-code request can be issued.
 */
const PAIRING_CODE_DELAY_MS = 3000;

/**
 * Maximum time (ms) to wait for WhatsApp to return a pairing code before
 * treating the request as failed.
 */
const PAIRING_CODE_TIMEOUT_MS = 30000;

/**
 * Delay (ms) before attempting to reconnect a dropped session.
 * The delay prevents tight reconnect loops on transient network errors.
 */
const RECONNECT_DELAY_MS = 5000;

/**
 * Number of users whose sessions are restored concurrently on server startup.
 * Batching avoids overwhelming WhatsApp servers when many users are linked.
 */
const RECONNECT_BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// Silent Baileys logger (avoids noisy output in production)
// ---------------------------------------------------------------------------
const silentLogger = {
  level: 'silent',
  log: () => {},
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  child: () => silentLogger,
};

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

/** In-memory map of userId -> active WASocket instance */
const socketMap = new Map();

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Build the session directory path for a given user.
 * @param {string} userId
 * @returns {string}
 */
function sessionDir(userId) {
  return path.join(SESSION_ROOT, `user_${userId}`);
}

/**
 * Remove the on-disk session folder for a user and clean up the in-memory socket.
 * @param {string} userId
 */
async function cleanupSession(userId) {
  if (socketMap.has(userId)) {
    const sock = socketMap.get(userId);
    socketMap.delete(userId);
    try {
      sock.end();
    } catch (_) {
      // ignore errors when closing a broken socket
    }
  }

  const dir = sessionDir(userId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Update the user's whatsappStatus in the database.
 * @param {string} userId
 * @param {string} status  e.g. 'CONNECTED' | 'UNLINKED'
 * @param {string|null} [whatsappNumber]  Store the linked number when connecting.
 */
async function updateUserStatus(userId, status, whatsappNumber = undefined) {
  const data = { whatsappStatus: status };
  if (whatsappNumber !== undefined) {
    data.whatsappNumber = whatsappNumber;
  }
  await prisma.user.update({ where: { id: userId }, data }).catch((err) => {
    console.error(`[WaManager] Failed to update DB status for user ${userId}:`, err.message);
  });
}

// ---------------------------------------------------------------------------
// Socket factory
// ---------------------------------------------------------------------------

/**
 * Create and configure a Baileys socket for a user.
 * Handles connection events, credential saving, and status updates.
 *
 * @param {string} userId
 * @param {object} state   Baileys auth state (from useMultiFileAuthState)
 * @param {function} saveCreds  Baileys saveCreds callback
 * @returns {WASocket}
 */
function createSocket(userId, state, saveCreds) {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('SMSPaisa'),
    logger: silentLogger,
  });

  socketMap.set(userId, sock);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`[WaManager] User ${userId} WhatsApp connected.`);
      const linkedNumber = sock.user?.id?.split(':')[0] ?? null;
      await updateUserStatus(userId, 'CONNECTED', linkedNumber);
    } else if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode
          : null;

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log(`[WaManager] User ${userId} connection dropped (code ${statusCode}), reconnecting…`);
        setTimeout(() => reconnect(userId), RECONNECT_DELAY_MS);
      } else {
        console.log(`[WaManager] User ${userId} logged out. Cleaning up session.`);
        await updateUserStatus(userId, 'UNLINKED', null);
        await cleanupSession(userId);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  return sock;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request an 8-digit pairing code for a user's phone number.
 *
 * Initialises a new Baileys socket (or reuses an existing one), waits for it
 * to reach a state where pairing codes can be requested, then returns the code.
 *
 * @param {string} userId
 * @param {string} phoneNumber  E.164-style digits only, e.g. "919876543210"
 * @returns {Promise<string>}   8-character pairing code, e.g. "ABCD1234"
 */
async function requestPairingCode(userId, phoneNumber) {
  // If there's already a connected socket, tear it down first
  if (socketMap.has(userId)) {
    await cleanupSession(userId);
  }

  const dir = sessionDir(userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const sock = createSocket(userId, state, saveCreds);

  // Wait until the socket has set up its connection layer, then request code.
  // Baileys needs PAIRING_CODE_DELAY_MS to reach the pre-auth state before
  // requestPairingCode() can be called.
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for pairing code from WhatsApp'));
    }, PAIRING_CODE_TIMEOUT_MS);

    setTimeout(async () => {
      try {
        const pairingCode = await sock.requestPairingCode(phoneNumber);
        clearTimeout(timeout);
        resolve(pairingCode);
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    }, PAIRING_CODE_DELAY_MS);
  });

  return code;
}

/**
 * Reconnect a user's WhatsApp session using their saved credentials.
 * Called on server startup for all users whose status is 'CONNECTED'.
 *
 * @param {string} userId
 */
async function reconnect(userId) {
  const dir = sessionDir(userId);
  if (!fs.existsSync(dir)) {
    console.log(`[WaManager] No saved session for user ${userId}, skipping reconnect.`);
    await updateUserStatus(userId, 'UNLINKED');
    return;
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(dir);
    createSocket(userId, state, saveCreds);
    console.log(`[WaManager] Reconnecting session for user ${userId}…`);
  } catch (err) {
    console.error(`[WaManager] Failed to reconnect user ${userId}:`, err.message);
    await updateUserStatus(userId, 'UNLINKED');
  }
}

/**
 * Log out a user from WhatsApp: closes their socket, removes the session folder,
 * and marks them as UNLINKED in the DB.
 *
 * @param {string} userId
 */
async function logout(userId) {
  if (socketMap.has(userId)) {
    const sock = socketMap.get(userId);
    try {
      await sock.logout();
    } catch (_) {
      // ignore – we clean up regardless
    }
  }
  await updateUserStatus(userId, 'UNLINKED', null);
  await cleanupSession(userId);
}

/**
 * Initialise the WhatsApp manager on server startup.
 * Queries the DB for all users with whatsappStatus === 'CONNECTED' and
 * calls reconnect() for each one in small batches so their background sessions
 * are restored without requiring user interaction and without overwhelming
 * WhatsApp servers.
 */
async function initWaManager() {
  console.log('[WaManager] Initialising WhatsApp manager…');
  try {
    const connectedUsers = await prisma.user.findMany({
      where: { whatsappStatus: 'CONNECTED' },
      select: { id: true },
    });

    if (connectedUsers.length === 0) {
      console.log('[WaManager] No users with active WhatsApp sessions to restore.');
      return;
    }

    console.log(`[WaManager] Restoring ${connectedUsers.length} WhatsApp session(s) in batches of ${RECONNECT_BATCH_SIZE}…`);

    // Process in batches to avoid overwhelming WhatsApp servers
    for (let i = 0; i < connectedUsers.length; i += RECONNECT_BATCH_SIZE) {
      const batch = connectedUsers.slice(i, i + RECONNECT_BATCH_SIZE);
      await Promise.allSettled(batch.map(({ id }) => reconnect(id)));
    }
  } catch (err) {
    console.error('[WaManager] Failed to initialise:', err.message);
  }
}

module.exports = { socketMap, requestPairingCode, reconnect, logout, initWaManager };
