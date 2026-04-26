/**
 * admin.js
 * Internal HTTP admin API.
 * Listens on ADMIN_PORT (default 9090) bound to 127.0.0.1 ONLY.
 * Never expose this port publicly.
 *
 * Endpoints:
 *   GET  /admin/status              Server status + player list
 *   GET  /admin/players             List online players
 *   POST /admin/kick/:username      Kick a player (optional reason in body)
 *   POST /admin/broadcast           Broadcast a chat message to all players
 *
 * Authentication: set ADMIN_TOKEN env var.
 * All requests must include:  Authorization: Bearer <ADMIN_TOKEN>
 * If ADMIN_TOKEN is not set, the API rejects all requests in production
 * (ONLINE_MODE=true) and allows access in dev mode (ONLINE_MODE=false).
 */

'use strict';

const http   = require('http');
const log    = require('./logger')('Admin');
const config = require('./config');

let _adminServer = null;

function auth(req, res) {
  // Enforce token when set, or when running in online (production) mode
  const tokenRequired = config.ADMIN_TOKEN || config.ONLINE_MODE;
  if (!tokenRequired) return true; // dev mode, no token set

  if (!config.ADMIN_TOKEN) {
    // Online mode but no token configured - block all access with a clear message
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Admin API disabled: set ADMIN_TOKEN in .env' }));
    return false;
  }

  const header = req.headers['authorization'] || '';
  if (header !== `Bearer ${config.ADMIN_TOKEN}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function startAdminServer(mcServer) {
  return new Promise((resolve, reject) => {
    _adminServer = http.createServer(async (req, res) => {
      if (!auth(req, res)) return;

      const url    = req.url.split('?')[0];
      const method = req.method;

      if (method === 'GET' && url === '/admin/status') {
        const players = Object.values(mcServer.players || {}).map((p) => p.username);
        return json(res, 200, {
          uptime:     Math.floor(process.uptime()),
          players,
          maxPlayers: config.MAX_PLAYERS,
          version:    config.MC_VERSION,
          onlineMode: config.ONLINE_MODE,
        });
      }

      if (method === 'GET' && url === '/admin/players') {
        const players = Object.values(mcServer.players || {}).map((p) => ({
          username: p.username,
          ping:     p.ping,
          ip:       p.socket?.remoteAddress,
        }));
        return json(res, 200, { players });
      }

      const kickMatch = url.match(/^\/admin\/kick\/(.+)$/);
      if (method === 'POST' && kickMatch) {
        const username = decodeURIComponent(kickMatch[1]);
        const body     = await readBody(req);
        const reason   = body.reason || 'Kicked by admin';
        const player   = Object.values(mcServer.players || {}).find((p) => p.username === username);
        if (!player) return json(res, 404, { error: `Player "${username}" not found` });
        player.kick(reason);
        log.info(`Kicked ${username}: ${reason}`);
        return json(res, 200, { kicked: username, reason });
      }

      if (method === 'POST' && url === '/admin/broadcast') {
        const body    = await readBody(req);
        const message = body.message;
        if (!message) return json(res, 400, { error: '"message" field required' });
        mcServer.broadcast(message);
        log.info(`Broadcast: ${message}`);
        return json(res, 200, { broadcast: message });
      }

      json(res, 404, { error: 'Not found' });
    });

    _adminServer.on('error', reject);
    _adminServer.listen(config.ADMIN_PORT, '127.0.0.1', () => {
      log.info(`Admin API on 127.0.0.1:${config.ADMIN_PORT}`);
      resolve(_adminServer);
    });
  });
}

function stopAdminServer() {
  return new Promise((resolve) => {
    if (_adminServer) _adminServer.close(() => resolve());
    else resolve();
  });
}

module.exports = { startAdminServer, stopAdminServer };
