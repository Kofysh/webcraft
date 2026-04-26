/**
 * ws-bridge.js
 * Public WebSocket/WSS server — the ONLY port exposed to the internet.
 *
 * Features:
 *  - TLS (WSS) when CERT_PATH + KEY_PATH env vars are set, plain WS otherwise
 *  - Per-IP rate limiting (RATE_LIMIT_MAX connections per minute)
 *  - Active connection counter
 *  - HTTP GET / healthcheck → JSON stats for liveness probes
 */

'use strict';

const WebSocket = require('ws');
const net       = require('net');
const http      = require('http');
const https     = require('https');
const fs        = require('fs');
const log       = require('./logger')('WS');
const config    = require('./config');

const RATE_WINDOW_MS = 60_000;
const rateLimitMap   = new Map();
let activeConnections = 0;
let _wss = null;
let _httpServer = null;

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= config.RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of rateLimitMap)
    if (now > e.resetAt) rateLimitMap.delete(ip);
}, RATE_WINDOW_MS).unref();

/**
 * @returns {http.Server|https.Server}
 */
function createHttpServer() {
  const healthHandler = (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        activeConnections,
        uptime: Math.floor(process.uptime()),
        version: config.MC_VERSION,
        tls: !!(config.CERT_PATH && config.KEY_PATH),
      }));
    } else {
      res.writeHead(404); res.end();
    }
  };

  if (config.CERT_PATH && config.KEY_PATH) {
    log.info('TLS enabled — loading cert and key');
    return https.createServer({
      cert: fs.readFileSync(config.CERT_PATH),
      key:  fs.readFileSync(config.KEY_PATH),
    }, healthHandler);
  }

  log.warn('TLS not configured — running plain WS (set CERT_PATH + KEY_PATH for WSS)');
  return http.createServer(healthHandler);
}

function startWsBridge({ wsPort = config.WS_PORT, mcHost = '127.0.0.1', mcPort = config.MC_PORT } = {}) {
  return new Promise((resolve, reject) => {
    _httpServer = createHttpServer();
    const wss   = new WebSocket.Server({ server: _httpServer });
    _wss        = wss;

    wss.on('error', reject);

    wss.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress || 'unknown';

      if (!checkRateLimit(ip)) {
        log.warn(`Rate limited: ${ip}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      activeConnections++;
      log.info(`🔌 ${ip} connected (active: ${activeConnections})`);

      const tcp = net.createConnection({ host: mcHost, port: mcPort });

      ws.on('message',  (data)  => { if (tcp.writable) tcp.write(data); });
      tcp.on('data',    (chunk) => { if (ws.readyState === WebSocket.OPEN) ws.send(chunk); });

      const cleanup = (reason) => {
        activeConnections = Math.max(0, activeConnections - 1);
        log.info(`🔌 ${ip} disconnected — ${reason} (active: ${activeConnections})`);
        if (tcp.writable)                        tcp.destroy();
        if (ws.readyState !== WebSocket.CLOSED)  ws.close();
      };

      ws.on('close',  ()  => cleanup('WS closed'));
      ws.on('error',  (e) => cleanup(`WS error: ${e.message}`));
      tcp.on('close', ()  => cleanup('TCP closed'));
      tcp.on('error', (e) => cleanup(`TCP error: ${e.message}`));
    });

    _httpServer.on('error', reject);
    _httpServer.listen(wsPort, () => {
      const proto = config.CERT_PATH ? 'WSS/HTTPS' : 'WS/HTTP';
      log.info(`Bridge (${proto}) listening on :${wsPort}`);
      resolve({ wss, httpServer: _httpServer });
    });
  });
}

function stopWsBridge() {
  return new Promise((resolve) => {
    if (!_wss) return resolve();
    _wss.clients.forEach((ws) => ws.close(1001, 'Server shutting down'));
    _wss.close(() => {
      if (_httpServer) _httpServer.close(() => resolve());
      else resolve();
    });
  });
}

module.exports = { startWsBridge, stopWsBridge };
