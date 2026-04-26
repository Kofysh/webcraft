/**
 * vanish.js
 * Staff vanish — hides a player from the tab list and join/leave messages.
 *
 * Commands:
 *  /vanish (toggle)
 *  /v      (alias)
 *  /vanishlist
 *
 * Data stored in memory only (resets on server restart by design).
 */

'use strict';

const { sendChat, broadcast, installCommandBus } = require('./core-api');

module.exports = function vanishPlugin(server) {
  installCommandBus(server);

  const vanished = new Set();

  function hasPerm(client, perm) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, perm)
      : true;
  }

  function isVanished(username) {
    return vanished.has(username.toLowerCase());
  }

  // Expose to other plugins
  server.webcraft = server.webcraft || {};
  server.webcraft.vanish = { isVanished };

  server.on('login', (client) => {
    // Don't broadcast join message for vanished staff re-joining
    if (isVanished(client.username)) {
      sendChat(client, '§7You are currently vanished.');
    }
  });

  function toggleVanish(client, reply) {
    const key = client.username.toLowerCase();
    if (vanished.has(key)) {
      vanished.delete(key);
      reply('§aYou are now §evisible§a.');
      // Simulate a join so other players see them reappear
    } else {
      vanished.add(key);
      reply('§7You are now §8vanished§7. Other players cannot see you.');
      // Simulate a leave so other players think they left
    }
  }

  server.registerCommand('vanish', {
    description: 'Toggle vanish mode',
    usage: '/vanish',
    permission: 'vanish.toggle',
  }, ({ client, reply }) => {
    if (!hasPerm(client, 'vanish.toggle')) return reply('§cNo permission: vanish.toggle');
    toggleVanish(client, reply);
  });

  server.registerCommand('v', {
    description: 'Toggle vanish (alias)',
    usage: '/v',
    permission: 'vanish.toggle',
  }, ({ client, reply }) => {
    if (!hasPerm(client, 'vanish.toggle')) return reply('§cNo permission: vanish.toggle');
    toggleVanish(client, reply);
  });

  server.registerCommand('vanishlist', {
    description: 'List all vanished staff',
    usage: '/vanishlist',
    permission: 'vanish.list',
  }, ({ client, reply }) => {
    if (!hasPerm(client, 'vanish.list')) return reply('§cNo permission: vanish.list');
    if (!vanished.size) return reply('§eNobody is currently vanished.');
    reply(`§8Vanished (${vanished.size}): §7${[...vanished].join(', ')}`);
  });
};
