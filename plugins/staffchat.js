/**
 * staffchat.js
 * Private staff chat channel.
 *
 * Commands:
 *  /staffchat <message>   — send to staff channel
 *  /sc <message>          — alias
 *  /togglesc              — toggle auto-redirect to staff chat
 *
 * Permission: staffchat.use
 * All messages are prefixed with §c[Staff] and only visible to players with staffchat.use.
 */

'use strict';

const { sendChat, getOnlinePlayers, installCommandBus } = require('./core-api');

module.exports = function staffChatPlugin(server) {
  installCommandBus(server);

  const autoSc = new Set(); // usernames with togglesc active

  function hasPerm(client, perm) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, perm)
      : true;
  }

  function sendToStaff(senderUsername, message) {
    const msg = `§4[Staff] §c${senderUsername}§7: §f${message}`;
    for (const p of getOnlinePlayers(server)) {
      if (hasPerm(p, 'staffchat.use')) sendChat(p, msg);
    }
  }

  // Intercept chat for players with togglesc active
  server.on('chat', (client, message) => {
    if (!message || message.startsWith('/')) return;
    if (!autoSc.has(client.username.toLowerCase())) return;
    sendToStaff(client.username, message);
    // Swallow the message — return early before it reaches global chat
  });

  function registerSc(cmd) {
    server.registerCommand(cmd, {
      description: 'Send a message to staff chat',
      usage: `/${cmd} <message>`,
      permission: 'staffchat.use',
    }, ({ client, args, reply }) => {
      if (!hasPerm(client, 'staffchat.use')) return reply('§cNo permission: staffchat.use');
      const message = args.join(' ');
      if (!message) return reply(`§eUsage: /${cmd} <message>`);
      sendToStaff(client.username, message);
    });
  }

  registerSc('staffchat');
  registerSc('sc');

  server.registerCommand('togglesc', {
    description: 'Toggle auto staff chat redirect',
    usage: '/togglesc',
    permission: 'staffchat.use',
  }, ({ client, reply }) => {
    if (!hasPerm(client, 'staffchat.use')) return reply('§cNo permission: staffchat.use');
    const key = client.username.toLowerCase();
    if (autoSc.has(key)) {
      autoSc.delete(key);
      reply('§aStaff chat: §eoff');
    } else {
      autoSc.add(key);
      reply('§aStaff chat: §aon §7(all messages go to staff)');
    }
  });
};
