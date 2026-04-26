/**
 * invsee.js
 * Inspect another player's inventory (read-only, reported in chat).
 *
 * Note: flying-squid does not implement a full inventory API yet.
 * This plugin reports what data is available on the player object
 * and can be extended when flying-squid adds full inventory support.
 *
 * Commands:
 *  /invsee <player>
 */

'use strict';

const { findPlayer, installCommandBus } = require('./core-api');

module.exports = function invseePlugin(server) {
  installCommandBus(server);

  function hasPerm(client, perm) {
    return server.webcraft?.perms?.hasPermission
      ? server.webcraft.perms.hasPermission(client.username, perm)
      : true;
  }

  server.registerCommand('invsee', {
    description: "View a player's inventory",
    usage: '/invsee <player>',
    permission: 'invsee.use',
  }, ({ client, args, reply }) => {
    if (!hasPerm(client, 'invsee.use')) return reply('§cNo permission: invsee.use');
    const target = findPlayer(server, args[0]);
    if (!target) return reply(`§cPlayer not found: ${args[0]}`);

    const inventory = target.inventory?.slots || [];
    const items = inventory.filter(Boolean);

    if (!items.length) {
      return reply(`§e${target.username}§7's inventory appears empty (or unavailable).`);
    }

    reply(`§e${target.username}§7's inventory:`);
    for (const slot of items) {
      if (slot?.type) reply(`§7  Slot ${slot.slot ?? '?'}: §f${slot.type} x${slot.count || 1}`);
    }
  });
};
