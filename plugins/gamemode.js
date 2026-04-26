/**
 * gamemode.js
 * Gamemode control commands.
 *
 * Commands:
 *  /gamemode <0|1|2|3|survival|creative|adventure|spectator> [player]
 *  /gm <same>
 *  /gms  — survival
 *  /gmc  — creative
 *  /gma  — adventure
 *  /gmsp — spectator
 */

'use strict';

const { sendChat, findPlayer, installCommandBus } = require('./core-api');

const MODES = {
  survival: 0, s: 0, '0': 0,
  creative: 1, c: 1, '1': 1,
  adventure: 2, a: 2, '2': 2,
  spectator: 3, sp: 3, '3': 3,
};

const NAMES = ['Survival', 'Creative', 'Adventure', 'Spectator'];

module.exports = function gamemodePlugin(server) {
  installCommandBus(server);

  function hasPerm(client, perm) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, perm)
      : true;
  }

  function setGamemode(client, target, mode, reply) {
    const id = MODES[String(mode).toLowerCase()];
    if (id === undefined) return reply(`§cUnknown gamemode: ${mode}`);
    try {
      target.write('game_state_change', { reason: 3, gameMode: id });
      sendChat(target, `§aGamemode set to §e${NAMES[id]}`);
      if (target !== client) reply(`§aSet §e${target.username}§a's gamemode to §e${NAMES[id]}`);
    } catch (e) {
      reply(`§cFailed: ${e.message}`);
    }
  }

  function registerGm(command, mode, short = false) {
    server.registerCommand(command, {
      description: short ? `Gamemode ${mode}` : 'Set gamemode',
      usage: short ? `/${command} [player]` : `/${command} <mode> [player]`,
      permission: 'gamemode.set',
    }, ({ client, args, reply }) => {
      if (!hasPerm(client, 'gamemode.set')) return reply('§cNo permission: gamemode.set');
      const targetName = short ? args[0] : args[1];
      const modeArg    = short ? mode    : args[0];
      const target     = targetName ? findPlayer(server, targetName) : client;
      if (!target) return reply(`§cPlayer not found: ${targetName}`);
      setGamemode(client, target, modeArg, reply);
    });
  }

  registerGm('gamemode', null, false);
  registerGm('gm',       null, false);
  registerGm('gms',  'survival',  true);
  registerGm('gmc',  'creative',  true);
  registerGm('gma',  'adventure', true);
  registerGm('gmsp', 'spectator', true);
};
