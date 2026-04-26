/**
 * ban-manager.js
 * Ban/unban/tempban system with persistent storage.
 *
 * Commands:
 *  /ban <player> [reason]
 *  /unban <player>
 *  /tempban <player> <duration> [reason]   e.g. /tempban Steve 1d spam
 *  /banlist
 *  /isbanned <player>
 *
 * Durations: 30s, 10m, 2h, 7d
 * Data stored in data/bans.json
 */

'use strict';

const path = require('path');
const { ensureDir, loadJson, saveJson, sendChat, installCommandBus, findPlayer } = require('./core-api');

const UNITS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

function parseDuration(str) {
  const m = str.match(/^(\d+)([smhd])$/);
  if (!m) return null;
  return parseInt(m[1]) * (UNITS[m[2]] || 0);
}

function formatDuration(ms) {
  if (ms < 60000)   return `${Math.round(ms/1000)}s`;
  if (ms < 3600000) return `${Math.round(ms/60000)}m`;
  if (ms < 86400000) return `${Math.round(ms/3600000)}h`;
  return `${Math.round(ms/86400000)}d`;
}

module.exports = function banManager(server) {
  installCommandBus(server);

  const dataDir = ensureDir('./data');
  const file    = path.join(dataDir, 'bans.json');
  const state   = loadJson(file, { bans: {} });
  const save    = () => saveJson(file, state);

  function hasPerm(client, perm) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, perm)
      : true;
  }

  function isBanned(username) {
    const entry = state.bans[username.toLowerCase()];
    if (!entry) return false;
    if (entry.expiry && Date.now() > entry.expiry) {
      delete state.bans[username.toLowerCase()];
      save();
      return false;
    }
    return entry;
  }

  function ban(username, reason, expiry = null, bannedBy = 'Console') {
    state.bans[username.toLowerCase()] = { reason, expiry, bannedBy, at: Date.now() };
    save();
  }

  // Kick banned players on login
  server.on('login', (client) => {
    const entry = isBanned(client.username);
    if (!entry) return;
    const msg = entry.expiry
      ? `You are banned until ${new Date(entry.expiry).toUTCString()}. Reason: ${entry.reason}`
      : `You are permanently banned. Reason: ${entry.reason}`;
    client.kick(msg);
  });

  server.registerCommand('ban', {
    description: 'Permanently ban a player',
    usage: '/ban <player> [reason]',
    permission: 'ban.ban',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'ban.ban')) return reply('§cNo permission: ban.ban');
    const name   = args.shift();
    const reason = args.join(' ') || 'Banned by staff';
    if (!name) return reply('§eUsage: /ban <player> [reason]');
    ban(name, reason, null, client.username);
    const target = findPlayer(server, name);
    if (target) target.kick(`You have been banned: ${reason}`);
    reply(`§aBanned §e${name} §7— ${reason}`);
  });

  server.registerCommand('unban', {
    description: 'Unban a player',
    usage: '/unban <player>',
    permission: 'ban.unban',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'ban.unban')) return reply('§cNo permission: ban.unban');
    const name = args[0];
    if (!name) return reply('§eUsage: /unban <player>');
    if (!state.bans[name.toLowerCase()]) return reply(`§c${name} is not banned.`);
    delete state.bans[name.toLowerCase()];
    save();
    reply(`§aUnbanned §e${name}`);
  });

  server.registerCommand('tempban', {
    description: 'Temporarily ban a player',
    usage: '/tempban <player> <duration> [reason]',
    permission: 'ban.tempban',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'ban.tempban')) return reply('§cNo permission: ban.tempban');
    const name     = args.shift();
    const durStr   = args.shift();
    const reason   = args.join(' ') || 'Temp-banned by staff';
    if (!name || !durStr) return reply('§eUsage: /tempban <player> <30s|10m|2h|7d> [reason]');
    const ms = parseDuration(durStr);
    if (!ms) return reply('§cInvalid duration. Examples: 30s, 10m, 2h, 7d');
    const expiry = Date.now() + ms;
    ban(name, reason, expiry, client.username);
    const target = findPlayer(server, name);
    if (target) target.kick(`Temp-banned for ${durStr}: ${reason}`);
    reply(`§aTempbanned §e${name} §7for ${durStr} — ${reason}`);
  });

  server.registerCommand('banlist', {
    description: 'List all bans',
    usage: '/banlist',
    permission: 'ban.list',
  }, ({ client, reply }) => {
    if (!hasPerm(client, 'ban.list')) return reply('§cNo permission: ban.list');
    const entries = Object.entries(state.bans);
    if (!entries.length) return reply('§eNo active bans.');
    reply(`§eBanned players (${entries.length}):`);
    for (const [name, e] of entries) {
      const exp = e.expiry ? ` (${formatDuration(e.expiry - Date.now())} left)` : ' (permanent)';
      reply(`§c${name}§7${exp} — ${e.reason}`);
    }
  });

  server.registerCommand('isbanned', {
    description: 'Check if a player is banned',
    usage: '/isbanned <player>',
    permission: 'ban.list',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'ban.list')) return reply('§cNo permission: ban.list');
    const name  = args[0];
    const entry = isBanned(name);
    if (!entry) return reply(`§a${name} is not banned.`);
    reply(`§c${name} is banned: ${entry.reason}`);
  });
};
