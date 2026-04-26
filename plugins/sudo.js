/**
 * sudo.js
 * Force a player to execute a command or send a chat message.
 *
 * Commands:
 *  /sudo <player> <command or message>
 *
 * Permission: sudo.use
 * Example:
 *   /sudo Steve /spawn
 *   /sudo Steve hello everyone
 */

'use strict';

const { sendChat, findPlayer, installCommandBus } = require('./core-api');

module.exports = function sudoPlugin(server) {
  installCommandBus(server);

  function hasPerm(client, perm) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, perm)
      : true;
  }

  server.registerCommand('sudo', {
    description: 'Force a player to run a command or send a message',
    usage: '/sudo <player> <command|message>',
    permission: 'sudo.use',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'sudo.use')) return reply('§cNo permission: sudo.use');
    const targetName = args.shift();
    const input      = args.join(' ');
    if (!targetName || !input) return reply('§eUsage: /sudo <player> <command|message>');
    const target = findPlayer(server, targetName);
    if (!target) return reply(`§cPlayer not found: ${targetName}`);

    if (input.startsWith('/')) {
      // Dispatch as a command on behalf of the target
      server.emit('chat', target, input);
      reply(`§aSudoed §e${target.username} §ato run: §f${input}`);
    } else {
      // Fake a chat message from the target
      server.emit('chat', target, input);
      reply(`§aSudoed §e${target.username} §ato say: §f${input}`);
    }
  });
};
