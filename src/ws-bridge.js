/**
 * ws-bridge.js
 * Public WebSocket server — the ONLY port exposed to the internet.
 * Each connection gets its own raw TCP pipe to the internal flying-squid server.
 */

const WebSocket = require('ws');
const net       = require('net');

/**
 * @param {object} opts
 * @param {number} opts.wsPort   Public WebSocket port
 * @param {string} opts.mcHost   Internal MC host (127.0.0.1)
 * @param {number} opts.mcPort   Internal MC TCP port
 * @returns {Promise<WebSocket.Server>}
 */
function startWsBridge({ wsPort = 8080, mcHost = '127.0.0.1', mcPort = 25565 } = {}) {
  return new Promise((resolve, reject) => {
    const wss = new WebSocket.Server({ port: wsPort });

    wss.on('error', reject);
    wss.on('listening', () => resolve(wss));

    wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress || 'unknown';
      console.log(`[WS] New connection from ${ip}`);

      const tcp = net.createConnection({ host: mcHost, port: mcPort });

      // WebSocket → TCP
      ws.on('message', (data) => { if (tcp.writable) tcp.write(data); });

      // TCP → WebSocket
      tcp.on('data', (chunk) => { if (ws.readyState === WebSocket.OPEN) ws.send(chunk); });

      const cleanup = (reason) => {
        console.log(`[WS] Closed (${ip}) — ${reason}`);
        if (tcp.writable)                         tcp.destroy();
        if (ws.readyState !== WebSocket.CLOSED)   ws.close();
      };

      ws.on('close',  ()  => cleanup('WS closed'));
      ws.on('error',  (e) => cleanup(`WS error: ${e.message}`));
      tcp.on('close', ()  => cleanup('TCP closed'));
      tcp.on('error', (e) => cleanup(`TCP error: ${e.message}`));
    });
  });
}

module.exports = { startWsBridge };