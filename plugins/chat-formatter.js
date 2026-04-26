/**
 * chat-formatter.js
 * Formats global chat messages with group prefix, player name, and nick.
 *
 * Format:  [GROUP] NickOrName: message
 * Colors are configurable per group in the PREFIXES map below.
 *
 * Requires:
 *  - luckperms-lite.js (for groups)
 *  - nick.js (optional, for nick display)
 */

'use strict';

const { getOnlinePlayers, sendChat, installCommandBus } = require('./core-api');

// Group prefix format — add your groups here
const PREFIXES = {
  admin:     '§c[Admin] §r',
  moderator: '§9[Mod] §r',
  default:   '§7',
};

module.exports = function chatFormatterPlugin(server) {
  installCommandBus(server);

  server.on('chat', (client, message) => {
    if (!message || typeof message !== 'string') return;
    if (message.startsWith('/')) return; // commands handled by the bus

    const group  = server.webcraft?.perms?.getGroup(client.username) || 'default';
    const prefix = PREFIXES[group] || PREFIXES.default;
    const nick   = server.webcraft?.nick?.getNick(client.username) || client.username;

    const formatted = `${prefix}${nick}§r: ${message}`;

    for (const p of getOnlinePlayers(server)) {
      sendChat(p, formatted);
    }
  });
};
