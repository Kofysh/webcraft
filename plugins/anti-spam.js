/**
 * anti-spam.js
 * Protects against chat spam and command flood.
 *
 * Features:
 *  - Message rate limiter: X messages per N seconds per player
 *  - Duplicate message filter: same message sent twice in a row is blocked
 *  - Command flood filter: too many commands per second triggers a warning
 *  - Auto-mute: player is muted for ANTISPAM_MUTE_SECONDS after too many violations
 *
 * Config (env vars):
 *  ANTISPAM_MSG_MAX      — max messages per window (default: 5)
 *  ANTISPAM_WINDOW_MS    — window in ms (default: 3000)
 *  ANTISPAM_MUTE_SECONDS — auto-mute duration (default: 30)
 */

'use strict';

const { sendChat, installCommandBus } = require('./core-api');

const MSG_MAX      = parseInt(process.env.ANTISPAM_MSG_MAX)      || 5;
const WINDOW_MS    = parseInt(process.env.ANTISPAM_WINDOW_MS)    || 3000;
const MUTE_SECONDS = parseInt(process.env.ANTISPAM_MUTE_SECONDS) || 30;

module.exports = function antiSpamPlugin(server) {
  installCommandBus(server);

  // username.toLowerCase() => { count, windowStart, lastMessage, violations, mutedUntil }
  const state = new Map();

  function getState(username) {
    const key = username.toLowerCase();
    if (!state.has(key)) {
      state.set(key, {
        count: 0,
        windowStart: Date.now(),
        lastMessage: '',
        violations: 0,
        mutedUntil: 0,
      });
    }
    return state.get(key);
  }

  function warn(client, msg) {
    sendChat(client, `§c[AntiSpam] ${msg}`);
  }

  function autoMute(client, s) {
    s.mutedUntil = Date.now() + MUTE_SECONDS * 1000;
    s.violations = 0;
    warn(client, `You have been auto-muted for ${MUTE_SECONDS}s.`);
    console.warn(`[AntiSpam] Auto-muted ${client.username} for ${MUTE_SECONDS}s`);
  }

  server.on('chat', (client, message) => {
    if (!message || typeof message !== 'string') return;

    const s   = getState(client.username);
    const now = Date.now();

    // Check auto-mute
    if (s.mutedUntil > now) {
      warn(client, `You are muted for ${Math.ceil((s.mutedUntil - now) / 1000)}s more.`);
      return;
    }

    // Skip commands from rate limit (they have their own flood guard)
    if (message.startsWith('/')) {
      s.count++;
      if (s.count > MSG_MAX * 2) {
        s.violations++;
        warn(client, 'Stop flooding commands!');
        if (s.violations >= 3) autoMute(client, s);
      }
      return;
    }

    // Duplicate message filter
    if (message === s.lastMessage) {
      s.violations++;
      warn(client, 'Do not repeat the same message.');
      if (s.violations >= 3) autoMute(client, s);
      return;
    }

    // Reset window if expired
    if (now - s.windowStart > WINDOW_MS) {
      s.count      = 0;
      s.windowStart = now;
    }

    s.count++;
    s.lastMessage = message;

    if (s.count > MSG_MAX) {
      s.violations++;
      warn(client, `Slow down! Max ${MSG_MAX} messages per ${WINDOW_MS / 1000}s.`);
      if (s.violations >= 3) autoMute(client, s);
    }
  });

  // Clean up disconnected players
  server.on('playerLeave', (client) => {
    state.delete(client.username.toLowerCase());
  });
};
