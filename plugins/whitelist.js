/**
 * whitelist.js
 * Server whitelist — only listed players can join.
 *
 * Stored in data/whitelist.json.
 * Whitelist can be toggled on/off at runtime without restart.
 *
 * Commands (require whitelist.admin permission):
 *   /whitelist on               Enable the whitelist
 *   /whitelist off              Disable the whitelist
 *   /whitelist add <player>     Add a player
 *   /whitelist remove <player>  Remove a player
 *   /whitelist list             Show all whitelisted players
 *   /whitelist reload           Reload from disk
 *
 * Env:
 *   WHITELIST_ENABLED=true     Start with whitelist enabled (default: false)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { installCommandBus, sendChat } = require('./core-api');

const DATA_FILE = path.join(process.cwd(), 'data', 'whitelist.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { enabled: process.env.WHITELIST_ENABLED === 'true', players: [] };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = function whitelistPlugin(server) {
  installCommandBus(server);

  let state = loadState();

  // Block non-whitelisted players at login
  server.on('login', (client) => {
    if (!state.enabled) return;
    const listed = state.players.map((p) => p.toLowerCase());
    if (!listed.includes(client.username.toLowerCase())) {
      client.kick('You are not whitelisted on this server.');
    }
  });

  // Expose state on server.webcraft for admin dashboard
  server.webcraft = server.webcraft || {};
  server.webcraft.whitelist = {
    isEnabled: ()      => state.enabled,
    getList:   ()      => [...state.players],
    add:       (name)  => {
      if (!state.players.map((p) => p.toLowerCase()).includes(name.toLowerCase())) {
        state.players.push(name);
        saveState(state);
        return true;
      }
      return false;
    },
    remove: (name) => {
      const before = state.players.length;
      state.players = state.players.filter((p) => p.toLowerCase() !== name.toLowerCase());
      if (state.players.length !== before) { saveState(state); return true; }
      return false;
    },
    setEnabled: (val) => { state.enabled = val; saveState(state); },
    reload:     ()    => { state = loadState(); },
  };

  function hasPermission(client) {
    return server.webcraft?.perms?.hasPermission(client.username, 'whitelist.admin') ?? false;
  }

  server.registerCommand('whitelist', {
    description: 'Manage the server whitelist',
    usage:       '/whitelist <on|off|add|remove|list|reload>',
    permission:  'whitelist.admin',
  }, ({ client, args, reply }) => {
    if (!hasPermission(client)) return reply('§cNo permission.');

    const [sub, target] = args;

    switch (sub) {
      case 'on':
        server.webcraft.whitelist.setEnabled(true);
        return reply('§aWhitelist enabled.');

      case 'off':
        server.webcraft.whitelist.setEnabled(false);
        return reply('§aWhitelist disabled.');

      case 'add': {
        if (!target) return reply('§cUsage: /whitelist add <player>');
        const added = server.webcraft.whitelist.add(target);
        return reply(added ? `§aAdded §f${target}§a to the whitelist.` : `§e${target} is already whitelisted.`);
      }

      case 'remove': {
        if (!target) return reply('§cUsage: /whitelist remove <player>');
        const removed = server.webcraft.whitelist.remove(target);
        return reply(removed ? `§aRemoved §f${target}§a from the whitelist.` : `§e${target} was not on the whitelist.`);
      }

      case 'list': {
        const list = server.webcraft.whitelist.getList();
        if (!list.length) return reply('§7Whitelist is empty.');
        return reply(`§7Whitelisted players (${list.length}): §f${list.join('§7, §f')}`);
      }

      case 'reload':
        server.webcraft.whitelist.reload();
        return reply('§aWhitelist reloaded from disk.');

      default:
        return reply('§cUsage: /whitelist <on|off|add|remove|list|reload>');
    }
  });

  console.info(`[Whitelist] Loaded. Enabled: ${state.enabled}, Players: ${state.players.length}`);
};
