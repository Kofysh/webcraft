/**
 * minecraft-server.js
 * Wraps flying-squid — binds ONLY to 127.0.0.1.
 */

'use strict';

const { createServer } = require('flying-squid');
const World  = require('prismarine-world');
const log    = require('./logger')('MC');
const config = require('./config');

let _server = null;

function startMinecraftServer({ port = config.MC_PORT, version = config.MC_VERSION, onlineMode = config.ONLINE_MODE } = {}) {
  return new Promise((resolve, reject) => {
    const world  = new World({});
    const server = createServer({
      world, version, onlineMode,
      encryption:   onlineMode,
      host:         '127.0.0.1',
      port,
      maxPlayers:   config.MAX_PLAYERS,
      viewDistance: config.VIEW_DISTANCE,
      motd:         config.MOTD,
    });

    _server = server;

    server.on('error', (err) => { log.error(err.message); reject(err); });

    server.on('login', (client) => {
      log.info(`✅ ${client.username} joined`);
      client.write('position', { x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flags: 0 });
    });

    server.on('playerLeave', (client) => log.info(`👋 ${client.username} left`));

    server.on('listening', () => {
      log.info(`Ready on 127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

function stopMinecraftServer() {
  return new Promise((resolve) => {
    if (!_server) return resolve();
    try { _server.close(); } catch (_) {}
    resolve();
  });
}

module.exports = { startMinecraftServer, stopMinecraftServer };
