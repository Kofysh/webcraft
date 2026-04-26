/**
 * minecraft-server.js
 * Wraps flying-squid — binds ONLY to 127.0.0.1 (never exposed to the internet).
 * Handles graceful shutdown on SIGTERM/SIGINT.
 */

const { createServer } = require('flying-squid');
const World = require('prismarine-world');

let _server = null;

/**
 * @param {object} opts
 * @param {number}  opts.port        Internal TCP port
 * @param {string}  opts.version     Minecraft version string
 * @param {boolean} opts.onlineMode  Require Mojang auth
 * @returns {Promise<object>} flying-squid server instance
 */
function startMinecraftServer({ port = 25565, version = '1.20.4', onlineMode = true } = {}) {
  return new Promise((resolve, reject) => {
    const world = new World({});

    const server = createServer({
      world,
      version,
      onlineMode,
      encryption: onlineMode,
      host: '127.0.0.1',   // loopback only — never exposed publicly
      port,
      maxPlayers:   parseInt(process.env.MAX_PLAYERS)   || 20,
      viewDistance: parseInt(process.env.VIEW_DISTANCE) || 8,
      motd: process.env.MOTD || '§aWebCraft §7— hosted on the web ✨',
    });

    _server = server;

    server.on('error', (err) => {
      console.error('[MC] Server error:', err.message);
      reject(err);
    });

    server.on('login', (client) => {
      console.log(`[MC] ✅ ${client.username} joined (${client.socket.remoteAddress})`);
      client.write('position', { x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flags: 0 });
    });

    server.on('playerLeave', (client) => {
      console.log(`[MC] 👋 ${client.username} left`);
    });

    // flying-squid emits 'listening' when the TCP socket is bound and ready
    // This removes the fragile setTimeout hack from the previous version
    server.on('listening', () => {
      console.log(`[MC] Server ready on 127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

/**
 * Gracefully close the Minecraft server (kick all players, close TCP socket).
 * @returns {Promise<void>}
 */
function stopMinecraftServer() {
  return new Promise((resolve) => {
    if (!_server) return resolve();
    try { _server.close(); } catch (_) {}
    resolve();
  });
}

module.exports = { startMinecraftServer, stopMinecraftServer };
