/**
 * luckperms-lite.js
 * Lightweight permissions/group system inspired by LuckPerms.
 *
 * Features:
 *  - groups + inheritance-free permissions
 *  - per-user group assignment
 *  - wildcard support: webcraft.*, essentials.*
 *  - commands: /lp user, /lp group, /whoami
 */

'use strict';

const path = require('path');
const {
  ensureDir,
  loadJson,
  saveJson,
  sendChat,
  installCommandBus,
} = require('./core-api');

module.exports = function luckPermsLite(server, config) {
  installCommandBus(server);

  const dataDir = ensureDir('./data');
  const file = path.join(dataDir, 'permissions.json');

  const state = loadJson(file, {
    groups: {
      admin: {
        permissions: ['*'],
      },
      moderator: {
        permissions: [
          'essentials.kick',
          'essentials.mute',
          'essentials.unmute',
          'essentials.broadcast',
          'essentials.feed',
          'essentials.heal',
          'essentials.fly',
          'essentials.tp',
          'essentials.tphere',
        ],
      },
      default: {
        permissions: [
          'essentials.spawn',
          'essentials.home',
          'essentials.sethome',
          'essentials.msg',
          'essentials.reply',
          'essentials.warp',
          'essentials.warps',
        ],
      },
    },
    users: {},
  });

  const save = () => saveJson(file, state);

  function getGroup(username) {
    return state.users[username.toLowerCase()]?.group || 'default';
  }

  function setGroup(username, group) {
    state.users[username.toLowerCase()] = { group };
    save();
  }

  function hasPermission(username, permission) {
    const group = state.groups[getGroup(username)] || state.groups.default;
    const perms = group.permissions || [];
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;

    const parts = permission.split('.');
    for (let i = parts.length; i > 0; i--) {
      const wildcard = parts.slice(0, i).join('.') + '.*';
      if (perms.includes(wildcard)) return true;
    }
    return false;
  }

  server.webcraft = server.webcraft || {};
  server.webcraft.perms = { hasPermission, getGroup, setGroup, state };

  server.on('login', (client) => {
    if (!state.users[client.username.toLowerCase()]) {
      setGroup(client.username, 'default');
    }
  });

  server.registerCommand('whoami', {
    description: 'Show your current group',
    usage: '/whoami',
  }, ({ client, reply }) => {
    reply(`§eYou are in group: §b${getGroup(client.username)}`);
  });

  server.registerCommand('lp', {
    description: 'Manage users/groups',
    usage: '/lp <user|group> ...',
    permission: 'luckperms.manage',
  }, ({ client, args, reply }) => {
    if (!hasPermission(client.username, 'luckperms.manage')) {
      return reply('§cYou do not have permission: luckperms.manage');
    }

    const scope = args[0];
    if (scope === 'user' && args[1] && args[2] === 'parent' && args[3] === 'set' && args[4]) {
      const username = args[1];
      const group = args[4];
      if (!state.groups[group]) return reply(`§cUnknown group: ${group}`);
      setGroup(username, group);
      return reply(`§aSet group of §e${username} §ato §b${group}`);
    }

    if (scope === 'group' && args[1] && args[2] === 'permission' && args[3] === 'set' && args[4]) {
      const group = args[1];
      const perm = args[4];
      if (!state.groups[group]) state.groups[group] = { permissions: [] };
      if (!state.groups[group].permissions.includes(perm)) state.groups[group].permissions.push(perm);
      save();
      return reply(`§aAdded permission §e${perm} §ato group §b${group}`);
    }

    reply('§eUsage: /lp user <name> parent set <group>');
    reply('§e   or: /lp group <group> permission set <perm>');
  });
};
