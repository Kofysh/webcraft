/**
 * ws-bridge.js
 * Public WebSocket server — the ONLY port exposed to the internet.
 *
 * Features:
 *  - Raw bidirectional TCP pipe per WebSocket connection
 *  - Per-IP rate limiting (RATE_LIMIT_MAX connections per minute)
 *  - Active connection counter
 *  - HTTP GET / healthcheck → 200 + JSON stats for hosting platform liveness probes
 */

const WebSocket = require('ws');
const net       = require('net');
const http      = require('http');

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 10;
const RATE_WINDOW_MS = 60_000;

// ip => { count: number, resetAt: number }
const rateLimitMap = new Map();

let activeConnections = 0;
let _wss = null;

/**
 * Check if an IP has exceeded the connection rate limit.
 * @param {string} ip
 * @returns {boolean} true if allowed, false if blocked
 */
function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rateLimitMap.set(ip, entry);
    return true;
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

// Clean up stale rate limit entries every minute to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

/**
 * @param {object} opts
 * @param {number} opts.wsPort   Public WebSocket port
 * @param {string} opts.mcHost   Internal Minecraft host
 * @param {number} opts.mcPort   Internal Minecraft TCP port
 * @returns {Promise<{ wss: WebSocket.Server, httpServer: http.Server }>}
 */
function startWsBridge({ wsPort = 8080, mcHost = '127.0.0.1', mcPort = 25565 } = {}) {
  return new Promise((resolve, reject) => {

    // HTTP server handles both the healthcheck and WS upgrade
    const httpServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/') {
        const body = JSON.stringify({
          status: 'ok',
          activeConnections,
          uptime: Math.floor(process.uptime()),
          version: process.env.MC_VERSION || '1.20.4',
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    const wss = new WebSocket.Server({ server: httpServer });
    _wss = wss;

    wss.on('error', reject);

    wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress || 'unknown';

      if (!checkRateLimit(ip)) {
        console.warn(`[WS] 🚫 Rate limited: ${ip}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      activeConnections += 1;
      console.log(`[WS] 🔌 ${ip} connected (active: ${activeConnections})`);

      const tcp = net.createConnection({ host: mcHost, port: mcPort });

      // WebSocket → TCP
      ws.on('message', (data) => { if (tcp.writable) tcp.write(data); });

      // TCP → WebSocket
      tcp.on('data', (chunk) => { if (ws.readyState === WebSocket.OPEN) ws.send(chunk); });

      const cleanup = (reason) => {
        activeConnections = Math.max(0, activeConnections - 1);
        console.log(`[WS] 🔌 ${ip} disconnected — ${reason} (active: ${activeConnections})`);
        if (tcp.writable)                        tcp.destroy();
        if (ws.readyState !== WebSocket.CLOSED)  ws.close();
      };

      ws.on('close',  ()  => cleanup('WS closed'));
      ws.on('error',  (e) => cleanup(`WS error: ${e.message}`));
      tcp.on('close', ()  => cleanup('TCP closed'));
      tcp.on('error', (e) => cleanup(`TCP error: ${e.message}`));
    });

    httpServer.on('error', reject);
    httpServer.listen(wsPort, () => {
      console.log(`[WS] Bridge + healthcheck on :${wsPort}`);
      resolve({ wss, httpServer });
    });
  });
}

/**
 * Gracefully close all WebSocket connections and the HTTP server.
 * @returns {Promise<void>}
 */
function stopWsBridge() {
  return new Promise((resolve) => {
    if (!_wss) return resolve();
    _wss.clients.forEach((ws) => ws.close(1001, 'Server shutting down'));
    _wss.close(() => resolve());
  });
}

module.exports = { startWsBridge, stopWsBridge };
