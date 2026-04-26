/**
 * nick.js
 * Set a display nickname for players.
 *
 * Commands:
 *  /nick <nickname>     — set your nick
 *  /nick off            — reset your nick
 *  /nick <player> <nick> — set someone else's nick (requires nick.others)
 *  /realname <nick>     — find real username behind a nick
 *
 * Data stored in data/nicks.json
 */

'use strict';

const path = require('path');
const { ensureDir, loadJson, saveJson, sendChat, findPlayer, installCommandBus } = require('./core-api');

module.exports = function nickPlugin(server) {
  installCommandBus(server);

  const dataDir = ensureDir('./data');
  const file    = path.join(dataDir, 'nicks.json');
  const nicks   = loadJson(file, {});
  const save    = () => saveJson(file, nicks);

  function hasPerm(client, perm) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, perm)
      : true;
  }

  function getNick(username) {
    return nicks[username.toLowerCase()] || username;
  }

  // Expose to other plugins (e.g. chat formatter)
  server.webcraft = server.webcraft || {};
  server.webcraft.nick = { getNick };

  const NICK_RE = /^[a-zA-Z0-9§_\-]{1,32}$/;

  server.registerCommand('nick', {
    description: 'Set your nickname',
    usage: '/nick <nickname|off> [player]',
    permission: 'nick.set',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'nick.set')) return reply('§cNo permission: nick.set');

    let targetUsername = client.username;
    let nickArg        = args[0];

    // /nick <player> <nick> — set someone else's nick
    if (args.length >= 2 && hasPerm(client, 'nick.others')) {
      const maybe = findPlayer(server, args[0]);
      if (maybe) { targetUsername = maybe.username; nickArg = args[1]; }
    }

    if (!nickArg) return reply('§eUsage: /nick <nickname|off>');

    if (nickArg.toLowerCase() === 'off') {
      delete nicks[targetUsername.toLowerCase()];
      save();
      sendChat(findPlayer(server, targetUsername) || client, '§aYour nickname has been removed.');
      return;
    }

    if (!NICK_RE.test(nickArg)) {
      return reply('§cInvalid nickname. Use letters, numbers, §, _ or - (max 32 chars).');
    }

    nicks[targetUsername.toLowerCase()] = nickArg;
    save();
    sendChat(findPlayer(server, targetUsername) || client, `§aYour nick is now: ${nickArg}`);
    if (targetUsername !== client.username) reply(`§aSet nick of §e${targetUsername} §ato ${nickArg}`);
  });

  server.registerCommand('realname', {
    description: 'Find the real username behind a nickname',
    usage: '/realname <nickname>',
    permission: 'nick.realname',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'nick.realname')) return reply('§cNo permission: nick.realname');
    const search = (args[0] || '').toLowerCase();
    const entry  = Object.entries(nicks).find(([, v]) => v.toLowerCase() === search);
    if (!entry) return reply(`§cNo player found with nick: ${args[0]}`);
    reply(`§eNick §b${args[0]} §ebelongs to: §a${entry[0]}`);
  });
};
