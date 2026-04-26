/**
 * WebCraft - Entry point
 * Boots all subsystems in order and handles graceful shutdown.
 */

'use strict';

try { require('dotenv').config(); } catch (_) {}

const config   = require('./config');
const log      = require('./logger')('Main');
const { startMinecraftServer, stopMinecraftServer } = require('./minecraft-server');
const { startWsBridge, stopWsBridge }               = require('./ws-bridge');
const { startAdminServer, stopAdminServer }          = require('./admin');
const { startAutosave, stopAutosave }               = require('./world-persistence');
const { loadPlugins }                               = require('./plugins');

async function main() {
  log.info('WebCraft starting up...');
  log.info(`Minecraft ${config.MC_VERSION} | Online mode: ${config.ONLINE_MODE} | Max players: ${config.MAX_PLAYERS}`);

  const mcServer = await startMinecraftServer({
    port:       config.MC_PORT,
    version:    config.MC_VERSION,
    onlineMode: config.ONLINE_MODE,
  });
  log.info(`Minecraft server  -> 127.0.0.1:${config.MC_PORT}`);

  await startWsBridge({ wsPort: config.WS_PORT, mcHost: '127.0.0.1', mcPort: config.MC_PORT });
  const proto = config.CERT_PATH ? 'wss' : 'ws';
  log.info(`WS bridge         -> ${proto}://0.0.0.0:${config.WS_PORT}`);
  log.info(`Healthcheck       -> GET http://localhost:${config.WS_PORT}/`);

  await startAdminServer(mcServer);
  log.info(`Admin dashboard   -> http://127.0.0.1:${config.ADMIN_PORT}/`);

  startAutosave(mcServer);

  const plugins = loadPlugins(mcServer);
  if (plugins.length) log.info(`Plugins loaded: ${plugins.join(', ')}`);

  log.info(`Players connect via: npx webcraft-proxy ${proto}://<your-host>:${config.WS_PORT}`);
}

async function shutdown(signal) {
  log.warn(`Received ${signal} - shutting down gracefully...`);
  stopAutosave();
  await stopWsBridge();
  await stopAdminServer();
  await stopMinecraftServer();
  log.info('Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (e) => { log.error('Uncaught exception:', e);  shutdown('uncaughtException'); });
process.on('unhandledRejection', (r) => { log.error('Unhandled rejection:', r); shutdown('unhandledRejection'); });

main().catch((err) => { log.error('Fatal startup error:', err); process.exit(1); });
