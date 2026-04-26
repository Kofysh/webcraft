/**
 * WebCraft — Entry point
 * Starts the internal Minecraft server + the public WebSocket bridge
 */

const { startMinecraftServer } = require('./minecraft-server');
const { startWsBridge }        = require('./ws-bridge');

const MC_PORT     = parseInt(process.env.MC_PORT)  || 25565;
const WS_PORT     = parseInt(process.env.WS_PORT)  || 8080;
const MC_VERSION  = process.env.MC_VERSION || '1.20.4';
const ONLINE_MODE = process.env.ONLINE_MODE !== 'false';

(async () => {
  console.log('🧱  WebCraft — Minecraft server over WebSocket');
  console.log(`    Minecraft version : ${MC_VERSION}`);
  console.log(`    Online mode       : ${ONLINE_MODE}`);
  console.log('');

  await startMinecraftServer({ port: MC_PORT, version: MC_VERSION, onlineMode: ONLINE_MODE });
  console.log(`✅  Minecraft server  → internal TCP :${MC_PORT}`);

  await startWsBridge({ wsPort: WS_PORT, mcHost: '127.0.0.1', mcPort: MC_PORT });
  console.log(`✅  WebSocket bridge  → public  WS  :${WS_PORT}`);
  console.log('');
  console.log(`📡  Players connect with:  npx webcraft-proxy wss://<your-domain>:${WS_PORT}`);
})();