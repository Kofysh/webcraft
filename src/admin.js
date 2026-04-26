/**
 * admin.js
 * Internal HTTP admin API + web dashboard.
 * Listens on ADMIN_PORT (default 9090) bound to 127.0.0.1 ONLY.
 *
 * Routes:
 *   GET  /                          Web dashboard (HTML)
 *   GET  /admin/status              Server status JSON
 *   GET  /admin/players             Online players JSON
 *   GET  /admin/logs                SSE stream of server log lines
 *   POST /admin/kick/:username      Kick a player
 *   POST /admin/broadcast           Broadcast a message
 *   POST /admin/ban/:username       Ban a player
 *   POST /admin/unban/:username     Unban a player
 *   GET  /admin/bans                List active bans
 *
 * Auth: cookie session (login form) OR Authorization: Bearer <ADMIN_TOKEN> for API calls.
 */

'use strict';

const http   = require('http');
const path   = require('path');
const fs     = require('fs');
const log    = require('./logger')('Admin');
const config = require('./config');

let _adminServer  = null;
const sseClients  = new Set();
const logBuffer   = [];   // last 200 lines kept in memory
const MAX_BUFFER  = 200;

// ---- Log interceptor -------------------------------------------------------
// Monkey-patch console so every log line is also pushed to SSE clients.
const _origStdout = process.stdout.write.bind(process.stdout);
process.stdout.write = function (chunk, ...rest) {
  const line = typeof chunk === 'string' ? chunk.trim() : '';
  if (line) pushLog(line);
  return _origStdout(chunk, ...rest);
};

function pushLog(line) {
  logBuffer.push(line);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
  const data = `data: ${JSON.stringify(line)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch (_) { sseClients.delete(client); }
  }
}

// ---- Auth ------------------------------------------------------------------
const SESSIONS = new Set();

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map((c) => c.trim().split('=').map(decodeURIComponent)));
}

function isAuthenticated(req) {
  if (!config.ADMIN_TOKEN) return !config.ONLINE_MODE; // dev mode
  // Bearer token (API calls)
  const bearer = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (bearer === config.ADMIN_TOKEN) return true;
  // Session cookie (dashboard)
  const cookies = parseCookies(req);
  return SESSIONS.has(cookies.wc_session);
}

function randomToken() {
  return require('crypto').randomBytes(24).toString('hex');
}

// ---- Helpers ----------------------------------------------------------------
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

function readForm(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const params = {};
      for (const pair of body.split('&')) {
        const [k, v] = pair.split('=').map(decodeURIComponent);
        if (k) params[k.replace(/\+/g, ' ')] = (v || '').replace(/\+/g, ' ');
      }
      resolve(params);
    });
  });
}

// ---- Ban helpers (reads data/bans.json if ban-manager plugin is active) -----
function getBans() {
  try {
    const file = path.join(process.cwd(), 'data', 'bans.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).bans || {};
  } catch { return {}; }
}

function writeBan(username, reason, expiry, bannedBy) {
  try {
    const file  = path.join(process.cwd(), 'data', 'bans.json');
    const state = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { bans: {} }; } })();
    state.bans[username.toLowerCase()] = { reason, expiry: expiry || null, bannedBy, at: Date.now() };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  } catch (e) { log.error('writeBan failed:', e.message); }
}

function removeBan(username) {
  try {
    const file  = path.join(process.cwd(), 'data', 'bans.json');
    const state = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { bans: {} }; } })();
    delete state.bans[username.toLowerCase()];
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  } catch (e) { log.error('removeBan failed:', e.message); }
}

// ---- Dashboard HTML --------------------------------------------------------
function dashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebCraft Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh}
  header{background:#1a1d27;border-bottom:1px solid #2d3148;padding:14px 24px;display:flex;align-items:center;gap:12px}
  header h1{font-size:1.15rem;font-weight:600;letter-spacing:.3px}
  header span{font-size:.75rem;background:#2563eb;color:#fff;padding:2px 8px;border-radius:99px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:20px;max-width:1200px;margin:0 auto}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  .card{background:#1a1d27;border:1px solid #2d3148;border-radius:10px;padding:18px}
  .card h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:14px}
  .stat{font-size:2rem;font-weight:700;color:#38bdf8}
  .stat small{font-size:.9rem;color:#64748b;margin-left:4px}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;color:#64748b;font-weight:500;padding:6px 8px;border-bottom:1px solid #2d3148}
  td{padding:7px 8px;border-bottom:1px solid #1e2132}
  tr:last-child td{border-bottom:none}
  .btn{cursor:pointer;border:none;border-radius:6px;padding:5px 12px;font-size:.8rem;font-weight:500;transition:opacity .15s}
  .btn:hover{opacity:.8}
  .btn-red{background:#dc2626;color:#fff}
  .btn-yellow{background:#d97706;color:#fff}
  .btn-blue{background:#2563eb;color:#fff}
  .btn-green{background:#16a34a;color:#fff}
  .empty{color:#475569;font-size:.85rem;text-align:center;padding:20px 0}
  #log{background:#0a0c14;border-radius:8px;padding:12px;font-family:'Fira Mono','Courier New',monospace;font-size:.75rem;height:280px;overflow-y:auto;color:#94a3b8;white-space:pre-wrap;word-break:break-all}
  .log-warn{color:#f59e0b}
  .log-error{color:#ef4444}
  .log-info{color:#94a3b8}
  input,textarea{background:#0f1117;border:1px solid #2d3148;border-radius:6px;color:#e2e8f0;padding:8px 10px;font-size:.85rem;width:100%}
  textarea{resize:vertical;min-height:60px}
  .form-row{display:flex;gap:8px;margin-top:8px}
  .form-row input{flex:1}
  #toast{position:fixed;bottom:20px;right:20px;background:#1e293b;border:1px solid #2d3148;border-radius:8px;padding:10px 16px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;max-width:300px}
  #toast.show{opacity:1}
  .badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:.7rem;font-weight:600}
  .badge-online{background:#16a34a22;color:#4ade80}
  .badge-banned{background:#dc262622;color:#f87171}
  .uptime{font-size:.75rem;color:#64748b}
  .card-wide{grid-column:1/-1}
  #bans-body tr.expired td{opacity:.4}
  .logout{margin-left:auto;font-size:.8rem;color:#64748b;text-decoration:none}
  .logout:hover{color:#e2e8f0}
</style>
</head>
<body>
<header>
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
  <h1>WebCraft Admin</h1>
  <span id="mc-version">...</span>
  <a class="logout" href="/admin/logout">Logout</a>
</header>
<div class="grid">

  <!-- Stats -->
  <div class="card">
    <h2>Server Status</h2>
    <div style="display:flex;gap:32px;flex-wrap:wrap;margin-top:4px">
      <div><div class="stat" id="stat-players">-</div><div class="uptime">online players</div></div>
      <div><div class="stat" id="stat-max">-</div><div class="uptime">max slots</div></div>
      <div><div class="stat" id="stat-uptime">-</div><div class="uptime">uptime</div></div>
    </div>
  </div>

  <!-- Broadcast -->
  <div class="card">
    <h2>Broadcast</h2>
    <textarea id="bc-msg" placeholder="Message to all players..."></textarea>
    <div class="form-row" style="margin-top:8px">
      <button class="btn btn-blue" onclick="broadcast()">Send to all</button>
    </div>
  </div>

  <!-- Players -->
  <div class="card">
    <h2>Online Players</h2>
    <table>
      <thead><tr><th>Username</th><th>Ping</th><th>IP</th><th></th></tr></thead>
      <tbody id="players-body"><tr><td colspan="4" class="empty">No players online</td></tr></tbody>
    </table>
  </div>

  <!-- Bans -->
  <div class="card">
    <h2>Ban Manager</h2>
    <div class="form-row">
      <input id="ban-username" placeholder="Username">
      <input id="ban-reason" placeholder="Reason">
      <button class="btn btn-red" onclick="banPlayer()">Ban</button>
    </div>
    <table style="margin-top:12px">
      <thead><tr><th>Player</th><th>Reason</th><th>By</th><th></th></tr></thead>
      <tbody id="bans-body"><tr><td colspan="4" class="empty">No active bans</td></tr></tbody>
    </table>
  </div>

  <!-- Logs -->
  <div class="card card-wide">
    <h2>Live Logs <span style="font-size:.7rem;color:#64748b;text-transform:none;letter-spacing:0">last ${MAX_BUFFER} lines</span></h2>
    <div id="log"></div>
  </div>

</div>
<div id="toast"></div>
<script>
const TOKEN = document.cookie.replace(/(?:^|.*;)\\s*wc_session\\s*=\\s*([^;]*).*$|^.*$/,'$1');
const H = { 'Content-Type':'application/json', 'Authorization': 'Bearer '+TOKEN };

function fmt(s){return s<60?s+'s':s<3600?Math.floor(s/60)+'m':Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m';}

function toast(msg,ok=true){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.style.borderColor=ok?'#16a34a':'#dc2626';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

async function api(method,url,body){
  const r=await fetch(url,{method,headers:H,body:body?JSON.stringify(body):undefined});
  return r.json();
}

async function refresh(){
  const [status,players,bans]=await Promise.all([
    api('GET','/admin/status'),
    api('GET','/admin/players'),
    api('GET','/admin/bans'),
  ]);
  document.getElementById('mc-version').textContent='v'+status.version;
  document.getElementById('stat-players').textContent=status.players.length;
  document.getElementById('stat-max').textContent=status.maxPlayers;
  document.getElementById('stat-uptime').textContent=fmt(status.uptime);

  const pb=document.getElementById('players-body');
  if(!players.players.length){
    pb.innerHTML='<tr><td colspan="4" class="empty">No players online</td></tr>';
  } else {
    pb.innerHTML=players.players.map(p=>`
      <tr>
        <td><span class="badge badge-online">online</span> ${esc(p.username)}</td>
        <td>${p.ping||'-'}ms</td>
        <td><code style="font-size:.7rem">${esc(p.ip||'-')}</code></td>
        <td>
          <button class="btn btn-yellow" onclick="kick('${esc(p.username)}')">Kick</button>
          <button class="btn btn-red" style="margin-left:4px" onclick="quickBan('${esc(p.username)}')">Ban</button>
        </td>
      </tr>`).join('');
  }

  const bb=document.getElementById('bans-body');
  const banEntries=Object.entries(bans.bans||{});
  if(!banEntries.length){
    bb.innerHTML='<tr><td colspan="4" class="empty">No active bans</td></tr>';
  } else {
    const now=Date.now();
    bb.innerHTML=banEntries.map(([name,e])=>{
      const expired=e.expiry&&now>e.expiry;
      return `<tr class="${expired?'expired':''}"><td>${esc(name)}</td><td>${esc(e.reason)}</td><td>${esc(e.bannedBy||'-')}</td><td><button class="btn btn-green" onclick="unban('${esc(name)}')">Unban</button></td></tr>`;
    }).join('');
  }
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function kick(u){
  const reason=prompt('Kick reason:','Kicked by admin');
  if(!reason)return;
  const r=await api('POST','/admin/kick/'+encodeURIComponent(u),{reason});
  toast(r.error||'Kicked '+u,!r.error);
  refresh();
}

async function quickBan(u){
  const reason=prompt('Ban reason:','Banned by admin');
  if(!reason)return;
  const r=await api('POST','/admin/ban/'+encodeURIComponent(u),{reason});
  toast(r.error||'Banned '+u,!r.error);
  refresh();
}

async function banPlayer(){
  const u=document.getElementById('ban-username').value.trim();
  const reason=document.getElementById('ban-reason').value.trim()||'Banned by admin';
  if(!u)return toast('Enter a username',false);
  const r=await api('POST','/admin/ban/'+encodeURIComponent(u),{reason});
  toast(r.error||'Banned '+u,!r.error);
  document.getElementById('ban-username').value='';
  document.getElementById('ban-reason').value='';
  refresh();
}

async function unban(u){
  const r=await api('POST','/admin/unban/'+encodeURIComponent(u),{});
  toast(r.error||'Unbanned '+u,!r.error);
  refresh();
}

async function broadcast(){
  const msg=document.getElementById('bc-msg').value.trim();
  if(!msg)return;
  const r=await api('POST','/admin/broadcast',{message:msg});
  toast(r.error||'Broadcast sent',!r.error);
  document.getElementById('bc-msg').value='';
}

// SSE log stream
const logEl=document.getElementById('log');
const evtSource=new EventSource('/admin/logs');
evtSource.onmessage=e=>{
  const line=JSON.parse(e.data);
  const div=document.createElement('div');
  div.className=line.includes('WARN')?'log-warn':line.includes('ERROR')?'log-error':'log-info';
  div.textContent=line;
  logEl.appendChild(div);
  if(logEl.children.length>200)logEl.removeChild(logEl.firstChild);
  logEl.scrollTop=logEl.scrollHeight;
};

refresh();
setInterval(refresh,5000);
</script>
</body>
</html>`;
}

// ---- Login page ------------------------------------------------------------
function loginHtml(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebCraft Admin - Login</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .box{background:#1a1d27;border:1px solid #2d3148;border-radius:12px;padding:32px;width:100%;max-width:360px}
  h1{font-size:1.1rem;margin-bottom:24px;color:#38bdf8}
  label{font-size:.8rem;color:#94a3b8;display:block;margin-bottom:4px}
  input{background:#0f1117;border:1px solid #2d3148;border-radius:6px;color:#e2e8f0;padding:9px 12px;font-size:.9rem;width:100%;margin-bottom:14px}
  button{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:10px;font-size:.9rem;font-weight:500;width:100%;cursor:pointer}
  button:hover{background:#1d4ed8}
  .error{background:#dc262622;border:1px solid #dc2626;border-radius:6px;padding:8px 12px;font-size:.8rem;color:#f87171;margin-bottom:14px}
</style>
</head>
<body>
<div class="box">
  <h1>WebCraft Admin</h1>
  ${error ? '<div class="error">Invalid password</div>' : ''}
  <form method="POST" action="/admin/login">
    <label>Admin Token</label>
    <input type="password" name="token" placeholder="Enter admin token" autofocus required>
    <button type="submit">Sign in</button>
  </form>
</div>
</body>
</html>`;
}

// ---- Server ----------------------------------------------------------------
function startAdminServer(mcServer) {
  return new Promise((resolve, reject) => {
    _adminServer = http.createServer(async (req, res) => {
      const url    = req.url.split('?')[0];
      const method = req.method;

      // Login form
      if (method === 'GET' && url === '/admin/login') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(loginHtml(false));
      }

      if (method === 'POST' && url === '/admin/login') {
        const form = await readForm(req);
        if (!config.ADMIN_TOKEN || form.token === config.ADMIN_TOKEN) {
          const sid = randomToken();
          SESSIONS.add(sid);
          setTimeout(() => SESSIONS.delete(sid), 8 * 3600 * 1000); // 8h session
          res.writeHead(302, {
            'Set-Cookie': `wc_session=${sid}; HttpOnly; Path=/; SameSite=Strict`,
            Location:     '/',
          });
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(loginHtml(true));
      }

      if (url === '/admin/logout') {
        const cookies = parseCookies(req);
        SESSIONS.delete(cookies.wc_session);
        res.writeHead(302, { 'Set-Cookie': 'wc_session=; Max-Age=0; Path=/', Location: '/admin/login' });
        return res.end();
      }

      // All other routes require auth
      if (!isAuthenticated(req)) {
        const isApiCall = req.headers['authorization'] || req.headers['content-type'] === 'application/json';
        if (isApiCall) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Unauthorized' }));
        }
        res.writeHead(302, { Location: '/admin/login' });
        return res.end();
      }

      // Dashboard
      if (method === 'GET' && (url === '/' || url === '/admin')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(dashboardHtml());
      }

      // SSE log stream
      if (method === 'GET' && url === '/admin/logs') {
        res.writeHead(200, {
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection:      'keep-alive',
        });
        // Flush buffered lines
        for (const line of logBuffer) res.write(`data: ${JSON.stringify(line)}\n\n`);
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      // GET /admin/status
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

      // GET /admin/players
      if (method === 'GET' && url === '/admin/players') {
        const players = Object.values(mcServer.players || {}).map((p) => ({
          username: p.username,
          ping:     p.ping,
          ip:       p.socket?.remoteAddress,
        }));
        return json(res, 200, { players });
      }

      // GET /admin/bans
      if (method === 'GET' && url === '/admin/bans') {
        return json(res, 200, { bans: getBans() });
      }

      // POST /admin/kick/:username
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

      // POST /admin/ban/:username
      const banMatch = url.match(/^\/admin\/ban\/(.+)$/);
      if (method === 'POST' && banMatch) {
        const username = decodeURIComponent(banMatch[1]);
        const body     = await readBody(req);
        const reason   = body.reason || 'Banned via admin dashboard';
        writeBan(username, reason, null, 'admin-dashboard');
        const player = Object.values(mcServer.players || {}).find((p) => p.username.toLowerCase() === username.toLowerCase());
        if (player) player.kick(`You have been banned: ${reason}`);
        log.info(`Banned ${username}: ${reason}`);
        return json(res, 200, { banned: username, reason });
      }

      // POST /admin/unban/:username
      const unbanMatch = url.match(/^\/admin\/unban\/(.+)$/);
      if (method === 'POST' && unbanMatch) {
        const username = decodeURIComponent(unbanMatch[1]);
        removeBan(username);
        log.info(`Unbanned ${username}`);
        return json(res, 200, { unbanned: username });
      }

      // POST /admin/broadcast
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
      log.info(`Admin dashboard -> http://127.0.0.1:${config.ADMIN_PORT}/`);
      resolve(_adminServer);
    });
  });
}

function stopAdminServer() {
  return new Promise((resolve) => {
    for (const c of sseClients) { try { c.end(); } catch (_) {} }
    sseClients.clear();
    if (_adminServer) _adminServer.close(() => resolve());
    else resolve();
  });
}

module.exports = { startAdminServer, stopAdminServer };
