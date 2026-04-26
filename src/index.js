/**
 * WebCraft — Entry point
 * Starts the internal Minecraft server + the public WebSocket bridge.
 * Handles graceful shutdown on SIGTERM / SIGINT.
 */

const { startMinecraftServer, stopMinecraftServer } = require('./minecraft-server');
const { startWsBridge, stopWsBridge }               = require('./ws-bridge');

// Load .env file if present (development only — not needed in production)
try { require('dotenv').config(); } catch (_) {}

const MC_PORT     = parseInt(process.env.MC_PORT)  || 25565;
const WS_PORT     = parseInt(process.env.WS_PORT)  || 8080;
const MC_VERSION  = process.env.MC_VERSION         || '1.20.4';
const ONLINE_MODE = process.env.ONLINE_MODE        !== 'false';

async function main() {
  console.log('');
  console.log('🧱  WebCraft — Minecraft server over WebSocket');
  console.log(`    Minecraft version : ${MC_VERSION}`);
  console.log(`    Online mode       : ${ONLINE_MODE}`);
  console.log('');

  await startMinecraftServer({ port: MC_PORT, version: MC_VERSION, onlineMode: ONLINE_MODE });
  console.log(`✅  Minecraft server  → internal TCP 127.0.0.1:${MC_PORT}`);

  await startWsBridge({ wsPort: WS_PORT, mcHost: '127.0.0.1', mcPort: MC_PORT });
  console.log(`✅  WebSocket bridge  → public WS/HTTP :${WS_PORT}`);
  console.log(`🩺  Healthcheck       → GET http://localhost:${WS_PORT}/`);
  console.log('');
  console.log(`📡  Players: npx webcraft-proxy wss://<your-domain>:${WS_PORT}`);
  console.log('');
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[WebCraft] Received ${signal} — shutting down gracefully…`);
  await stopWsBridge();
  await stopMinecraftServer();
  console.log('[WebCraft] Goodbye 👋');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[WebCraft] Uncaught exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[WebCraft] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

main().catch((err) => {
  console.error('[WebCraft] Fatal startup error:', err);
  process.exit(1);
});
