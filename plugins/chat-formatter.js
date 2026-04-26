/**
 * chat-formatter.js
 * Formats global chat messages with group prefix, player name, and nick.
 *
 * Format: [GROUP] NickOrName: message
 *
 * This listener is registered AFTER installCommandBus() so the command bus
 * fires first. Messages starting with '/' never reach this handler.
 *
 * Requires: luckperms-lite.js (groups), nick.js (optional, for nick display)
 */

'use strict';

const { getOnlinePlayers, sendChat, installCommandBus } = require('./core-api');

const PREFIXES = {
  admin:     '§c[Admin] §r',
  moderator: '§9[Mod] §r',
  default:   '§7',
};

module.exports = function chatFormatterPlugin(server) {
  // Ensure the command bus is installed — idempotent call
  installCommandBus(server);

  // Use a named listener so it can be removed/debugged easily.
  // flying-squid emits 'chat' with (client, message) AFTER the packet is parsed.
  // The command bus listener was registered first (by installCommandBus) and
  // returns early for '/' messages, so by the time we get here the message
  // is guaranteed to NOT be a command.
  function onChat(client, message) {
    if (!message || typeof message !== 'string') return;
    if (message.startsWith('/')) return; // belt-and-suspenders guard

    const group     = server.webcraft?.perms?.getGroup(client.username) || 'default';
    const prefix    = PREFIXES[group] ?? PREFIXES.default;
    const nick      = server.webcraft?.nick?.getNick(client.username) || client.username;
    const formatted = `${prefix}${nick}§r: §f${message}`;

    for (const p of getOnlinePlayers(server)) {
      sendChat(p, formatted);
    }
  }

  // Register AFTER the synchronous setup of installCommandBus finishes
  setImmediate(() => server.on('chat', onChat));
};
