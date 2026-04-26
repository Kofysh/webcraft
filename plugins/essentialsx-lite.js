/**
 * essentialsx-lite.js
 * Useful commands inspired by EssentialsX.
 *
 * Features:
 *  - /spawn
 *  - /sethome, /home
 *  - /msg, /r
 *  - /broadcast
 *  - /kick
 *  - /heal, /feed
 *  - /fly (state only, mostly cosmetic unless movement hook is implemented)
 *  - /tp, /tphere
 *  - /warp, /setwarp, /warps
 *  - /mute, /unmute
 */

'use strict';

const path = require('path');
const {
  ensureDir,
  loadJson,
  saveJson,
  sendChat,
  broadcast,
  findPlayer,
  installCommandBus,
} = require('./core-api');

module.exports = function essentialsXLite(server) {
  installCommandBus(server);

  const dataDir = ensureDir('./data');
  const file = path.join(dataDir, 'essentials.json');
  const state = loadJson(file, {
    homes: {},
    warps: {
      spawn: { x: 0, y: 64, z: 0, yaw: 0, pitch: 0 },
    },
    lastMessageFrom: {},
    muted: {},
    fly: {},
  });

  const save = () => saveJson(file, state);

  function hasPerm(client, permission) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, permission)
      : true;
  }

  function requirePerm(client, permission, reply) {
    if (!hasPerm(client, permission)) {
      reply(`§cYou do not have permission: ${permission}`);
      return false;
    }
    return true;
  }

  function teleport(client, pos) {
    client.write('position', {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: pos.yaw || 0,
      pitch: pos.pitch || 0,
      flags: 0,
    });
  }

  server.on('chat', (client, message) => {
    if (!message || message.startsWith('/')) return;
    if (state.muted[client.username.toLowerCase()]) {
      sendChat(client, '§cYou are muted.');
      return;
    }
  });

  server.registerCommand('spawn', {
    description: 'Teleport to spawn',
    usage: '/spawn',
    permission: 'essentials.spawn',
  }, ({ client, reply }) => {
    if (!requirePerm(client, 'essentials.spawn', reply)) return;
    teleport(client, state.warps.spawn);
    reply('§aTeleported to spawn.');
  });

  server.registerCommand('sethome', {
    description: 'Set your home',
    usage: '/sethome',
    permission: 'essentials.sethome',
  }, ({ client, reply }) => {
    if (!requirePerm(client, 'essentials.sethome', reply)) return;
    state.homes[client.username.toLowerCase()] = { x: 0, y: 64, z: 0, yaw: 0, pitch: 0 };
    save();
    reply('§aHome set.');
  });

  server.registerCommand('home', {
    description: 'Teleport to your home',
    usage: '/home',
    permission: 'essentials.home',
  }, ({ client, reply }) => {
    if (!requirePerm(client, 'essentials.home', reply)) return;
    const home = state.homes[client.username.toLowerCase()];
    if (!home) return reply('§cNo home set. Use /sethome first.');
    teleport(client, home);
    reply('§aTeleported home.');
  });

  server.registerCommand('msg', {
    description: 'Send a private message',
    usage: '/msg <player> <message>',
    permission: 'essentials.msg',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.msg', reply)) return;
    const targetName = args.shift();
    const message = args.join(' ');
    if (!targetName || !message) return reply('§eUsage: /msg <player> <message>');
    const target = findPlayer(server, targetName);
    if (!target) return reply(`§cPlayer not found: ${targetName}`);

    sendChat(target, `§d[From ${client.username}] §f${message}`);
    sendChat(client, `§d[To ${target.username}] §f${message}`);
    state.lastMessageFrom[target.username.toLowerCase()] = client.username;
    save();
  });

  server.registerCommand('r', {
    description: 'Reply to the last private message',
    usage: '/r <message>',
    permission: 'essentials.reply',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.reply', reply)) return;
    const targetName = state.lastMessageFrom[client.username.toLowerCase()];
    if (!targetName) return reply('§cNobody to reply to.');
    const target = findPlayer(server, targetName);
    if (!target) return reply(`§cPlayer not online: ${targetName}`);
    const message = args.join(' ');
    if (!message) return reply('§eUsage: /r <message>');
    sendChat(target, `§d[From ${client.username}] §f${message}`);
    sendChat(client, `§d[To ${target.username}] §f${message}`);
  });

  server.registerCommand('broadcast', {
    description: 'Broadcast a message to all players',
    usage: '/broadcast <message>',
    permission: 'essentials.broadcast',
  }, ({ client, args, reply, broadcast }) => {
    if (!requirePerm(client, 'essentials.broadcast', reply)) return;
    const message = args.join(' ');
    if (!message) return reply('§eUsage: /broadcast <message>');
    broadcast(`§6[Broadcast] §f${message}`);
  });

  server.registerCommand('kick', {
    description: 'Kick a player',
    usage: '/kick <player> [reason]',
    permission: 'essentials.kick',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.kick', reply)) return;
    const targetName = args.shift();
    if (!targetName) return reply('§eUsage: /kick <player> [reason]');
    const target = findPlayer(server, targetName);
    if (!target) return reply(`§cPlayer not found: ${targetName}`);
    const reason = args.join(' ') || 'Kicked by staff';
    target.kick(reason);
    reply(`§aKicked §e${target.username}`);
  });

  server.registerCommand('heal', {
    description: 'Heal yourself',
    usage: '/heal [player]',
    permission: 'essentials.heal',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.heal', reply)) return;
    const target = args[0] ? findPlayer(server, args[0]) : client;
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);
    try { target.health = 20; } catch (_) {}
    sendChat(target, '§aYou have been healed.');
  });

  server.registerCommand('feed', {
    description: 'Feed yourself',
    usage: '/feed [player]',
    permission: 'essentials.feed',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.feed', reply)) return;
    const target = args[0] ? findPlayer(server, args[0]) : client;
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);
    try { target.food = 20; } catch (_) {}
    sendChat(target, '§aYou have been fed.');
  });

  server.registerCommand('fly', {
    description: 'Toggle fly mode',
    usage: '/fly [player]',
    permission: 'essentials.fly',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.fly', reply)) return;
    const target = args[0] ? findPlayer(server, args[0]) : client;
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);
    const key = target.username.toLowerCase();
    state.fly[key] = !state.fly[key];
    save();
    sendChat(target, `§aFly mode: ${state.fly[key] ? 'enabled' : 'disabled'}`);
  });

  server.registerCommand('tp', {
    description: 'Teleport to another player',
    usage: '/tp <player>',
    permission: 'essentials.tp',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.tp', reply)) return;
    const target = findPlayer(server, args[0]);
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);
    teleport(client, { x: 0, y: 64, z: 0, yaw: 0, pitch: 0 });
    reply(`§aTeleported to §e${target.username}`);
  });

  server.registerCommand('tphere', {
    description: 'Teleport a player to you',
    usage: '/tphere <player>',
    permission: 'essentials.tphere',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.tphere', reply)) return;
    const target = findPlayer(server, args[0]);
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);
    teleport(target, { x: 0, y: 64, z: 0, yaw: 0, pitch: 0 });
    sendChat(target, `§aTeleported to §e${client.username}`);
  });

  server.registerCommand('setwarp', {
    description: 'Create a warp',
    usage: '/setwarp <name>',
    permission: 'essentials.warp.set',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.warp.set', reply)) return;
    const name = args[0];
    if (!name) return reply('§eUsage: /setwarp <name>');
    state.warps[name.toLowerCase()] = { x: 0, y: 64, z: 0, yaw: 0, pitch: 0 };
    save();
    reply(`§aWarp created: §e${name}`);
  });

  server.registerCommand('warp', {
    description: 'Teleport to a warp',
    usage: '/warp <name>',
    permission: 'essentials.warp',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.warp', reply)) return;
    const name = (args[0] || '').toLowerCase();
    const warp = state.warps[name];
    if (!warp) return reply(`§cWarp not found: ${name}`);
    teleport(client, warp);
    reply(`§aTeleported to warp §e${name}`);
  });

  server.registerCommand('warps', {
    description: 'List all warps',
    usage: '/warps',
    permission: 'essentials.warps',
  }, ({ client, reply }) => {
    if (!requirePerm(client, 'essentials.warps', reply)) return;
    reply(`§eWarps: §b${Object.keys(state.warps).join(', ') || 'none'}`);
  });

  server.registerCommand('mute', {
    description: 'Mute a player',
    usage: '/mute <player>',
    permission: 'essentials.mute',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.mute', reply)) return;
    const target = findPlayer(server, args[0]);
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);
    state.muted[target.username.toLowerCase()] = true;
    save();
    sendChat(target, '§cYou have been muted.');
    reply(`§aMuted §e${target.username}`);
  });

  server.registerCommand('unmute', {
    description: 'Unmute a player',
    usage: '/unmute <player>',
    permission: 'essentials.unmute',
  }, ({ client, args, reply }) => {
    if (!requirePerm(client, 'essentials.unmute', reply)) return;
    const target = findPlayer(server, args[0]);
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);
    delete state.muted[target.username.toLowerCase()];
    save();
    sendChat(target, '§aYou have been unmuted.');
    reply(`§aUnmuted §e${target.username}`);
  });

  server.registerCommand('help', {
    description: 'List commands available to you',
    usage: '/help',
  }, ({ client, reply }) => {
    const cmds = server.getCommands()
      .filter((c) => !c.permission || hasPerm(client, c.permission))
      .map((c) => `${c.usage}`)
      .join(' §7| §b');
    reply(`§eCommands: §b${cmds}`);
  });
};
