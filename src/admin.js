'use strict';

const http   = require('http');
const path   = require('path');
const fs     = require('fs');
const log    = require('./logger')('Admin');
const config = require('./config');

let _adminServer  = null;
const sseClients  = new Set();
const logBuffer   = [];
const MAX_BUFFER  = 200;

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

const SESSIONS = new Set();

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(
    raw.split(';')
      .map((c) => c.trim().split('=').map((s) => decodeURIComponent(s || '')))
      .filter(([k]) => k)
  );
}

function isAuthenticated(req) {
  if (!config.ADMIN_TOKEN) return !config.ONLINE_MODE;
  const bearer = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (bearer === config.ADMIN_TOKEN) return true;
  return SESSIONS.has(parseCookies(req).wc_session);
}

function randomToken() { return require('crypto').randomBytes(24).toString('hex'); }

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

function readForm(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const p = {};
      for (const pair of body.split('&')) {
        const [k, v] = pair.split('=').map(decodeURIComponent);
        if (k) p[k.replace(/\+/g, ' ')] = (v || '').replace(/\+/g, ' ');
      }
      resolve(p);
    });
  });
}

function getBans() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'bans.json'), 'utf8')).bans || {}; }
  catch { return {}; }
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

function getWhitelistApi(mcServer) { return mcServer?.webcraft?.whitelist ?? null; }

// ---------------------------------------------------------------------------
//  HTML: Login page
// ---------------------------------------------------------------------------
function loginHtml(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebCraft — Sign in</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0e1117;--surface:#161b27;--border:#1f2a3c;--accent:#5865f2;--accent-hover:#4752c4;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--success:#22c55e;--warn:#f59e0b}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;background-image:radial-gradient(ellipse at 60% 20%,rgba(88,101,242,.08) 0%,transparent 60%)}
.wrap{width:100%;max-width:380px;padding:16px}
.logo{display:flex;align-items:center;gap:10px;margin-bottom:32px;justify-content:center}
.logo svg{filter:drop-shadow(0 0 8px rgba(88,101,242,.5))}
.logo span{font-size:1.25rem;font-weight:700;letter-spacing:-.3px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px}
.card-title{font-size:.9rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:20px}
.field{margin-bottom:16px}
label{display:block;font-size:.78rem;font-weight:500;color:var(--muted);margin-bottom:6px}
input[type=password]{width:100%;background:#0a0d14;border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px 14px;font-size:.9rem;outline:none;transition:border-color .2s}
input[type=password]:focus{border-color:var(--accent)}
.btn-primary{width:100%;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:11px;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .2s;margin-top:4px}
.btn-primary:hover{background:var(--accent-hover)}
.error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px 14px;font-size:.82rem;color:#fca5a5;margin-bottom:16px}
.footer{text-align:center;margin-top:20px;font-size:.75rem;color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#5865f2" opacity=".9"/>
      <path d="M2 17l10 5 10-5" stroke="#5865f2" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M2 12l10 5 10-5" stroke="#5865f2" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>
    </svg>
    <span>WebCraft</span>
  </div>
  <div class="card">
    <div class="card-title">Administrator Login</div>
    ${error ? '<div class="error">Invalid token — please try again.</div>' : ''}
    <form method="POST" action="/admin/login">
      <div class="field">
        <label>Admin Token</label>
        <input type="password" name="token" placeholder="••••••••••••••••" autofocus required>
      </div>
      <button class="btn-primary" type="submit">Sign in to Dashboard</button>
    </form>
  </div>
  <div class="footer">WebCraft Admin Panel &mdash; localhost only</div>
</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
//  HTML: Dashboard
// ---------------------------------------------------------------------------
function dashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebCraft Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0e1117;--surface:#161b27;--surface2:#1c2333;--border:#1f2a3c;
  --accent:#5865f2;--accent-hover:#4752c4;--accent-glow:rgba(88,101,242,.25);
  --text:#e2e8f0;--text2:#94a3b8;--muted:#4b5a6e;
  --success:#22c55e;--success-bg:rgba(34,197,94,.1);
  --danger:#ef4444;--danger-bg:rgba(239,68,68,.1);
  --warn:#f59e0b;--warn-bg:rgba(245,158,11,.1);
  --sidebar-w:220px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);display:flex}

/* ---- Sidebar ---- */
.sidebar{
  width:var(--sidebar-w);min-width:var(--sidebar-w);height:100vh;
  background:var(--surface);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
}
.sidebar-logo{
  padding:20px 18px 14px;
  display:flex;align-items:center;gap:10px;
  border-bottom:1px solid var(--border);
}
.sidebar-logo svg{flex-shrink:0}
.sidebar-logo .brand{font-size:.95rem;font-weight:700;letter-spacing:-.2px}
.sidebar-logo .brand small{display:block;font-size:.68rem;font-weight:400;color:var(--text2);margin-top:1px}
.nav{flex:1;padding:12px 8px;overflow-y:auto}
.nav-section{font-size:.65rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);padding:8px 10px 4px;margin-top:8px}
.nav-section:first-child{margin-top:0}
.nav-item{
  display:flex;align-items:center;gap:10px;
  padding:9px 10px;border-radius:8px;
  font-size:.82rem;font-weight:500;color:var(--text2);
  cursor:pointer;transition:all .15s;user-select:none;
  border:none;background:none;width:100%;text-align:left;
}
.nav-item:hover{background:var(--surface2);color:var(--text)}
.nav-item.active{background:rgba(88,101,242,.15);color:var(--accent)}
.nav-item svg{flex-shrink:0;opacity:.7}
.nav-item.active svg{opacity:1}
.sidebar-footer{
  padding:12px 8px;border-top:1px solid var(--border);
}
.server-badge{
  display:flex;align-items:center;gap:8px;
  padding:9px 10px;border-radius:8px;
  background:var(--surface2);border:1px solid var(--border);
}
.server-badge .dot{width:7px;height:7px;border-radius:50%;background:var(--success);flex-shrink:0;box-shadow:0 0 6px var(--success)}
.server-badge .info{min-width:0}
.server-badge .info .name{font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.server-badge .info .ver{font-size:.68rem;color:var(--text2)}

/* ---- Main ---- */
.main{flex:1;display:flex;flex-direction:column;min-width:0;height:100vh;overflow:hidden}
.topbar{
  height:56px;min-height:56px;
  background:var(--surface);border-bottom:1px solid var(--border);
  display:flex;align-items:center;padding:0 24px;gap:12px;
}
.topbar-title{font-size:1rem;font-weight:600;flex:1}
.topbar-right{display:flex;align-items:center;gap:8px}
.stat-mini{
  display:flex;align-items:center;gap:6px;
  background:var(--surface2);border:1px solid var(--border);
  border-radius:8px;padding:5px 11px;font-size:.78rem;
}
.stat-mini .val{font-weight:700;color:var(--text)}
.stat-mini .lbl{color:var(--text2)}
.btn-logout{
  background:none;border:1px solid var(--border);
  border-radius:8px;padding:5px 12px;
  font-size:.78rem;font-weight:500;color:var(--text2);
  cursor:pointer;transition:all .15s;text-decoration:none;display:flex;align-items:center;gap:5px;
}
.btn-logout:hover{border-color:var(--danger);color:var(--danger)}

.content{flex:1;overflow-y:auto;padding:24px}

/* ---- Pages ---- */
.page{display:none;animation:fadeIn .15s ease}
.page.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

.page-header{margin-bottom:20px}
.page-header h1{font-size:1.2rem;font-weight:700}
.page-header p{font-size:.82rem;color:var(--text2);margin-top:3px}

.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px}
.stat-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:18px 20px;
  position:relative;overflow:hidden;
}
.stat-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
}
.stat-card.blue::before{background:var(--accent)}
.stat-card.green::before{background:var(--success)}
.stat-card.warn::before{background:var(--warn)}
.stat-card .sc-label{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:var(--text2);margin-bottom:8px}
.stat-card .sc-value{font-size:2rem;font-weight:700}
.stat-card.blue .sc-value{color:var(--accent)}
.stat-card.green .sc-value{color:var(--success)}
.stat-card.warn .sc-value{color:var(--warn)}
.stat-card .sc-sub{font-size:.72rem;color:var(--muted);margin-top:4px}

.card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;margin-bottom:16px;
}
.card-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:1px solid var(--border);
}
.card-head h2{font-size:.82rem;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text2)}
.card-body{padding:16px 18px}

table{width:100%;border-collapse:collapse}
th{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)}
td{padding:10px 12px;font-size:.84rem;border-bottom:1px solid #11161f}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}

.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:.7rem;font-weight:600}
.badge-online{background:var(--success-bg);color:var(--success)}
.badge-banned{background:var(--danger-bg);color:var(--danger)}
.badge-warn{background:var(--warn-bg);color:var(--warn)}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}

.btn{cursor:pointer;border:none;border-radius:7px;padding:5px 13px;font-size:.78rem;font-weight:600;transition:all .15s;display:inline-flex;align-items:center;gap:5px}
.btn-sm{padding:4px 10px;font-size:.74rem}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-hover)}
.btn-danger{background:var(--danger-bg);color:var(--danger);border:1px solid rgba(239,68,68,.25)}
.btn-danger:hover{background:var(--danger);color:#fff}
.btn-warn{background:var(--warn-bg);color:var(--warn);border:1px solid rgba(245,158,11,.25)}
.btn-warn:hover{background:var(--warn);color:#000}
.btn-success{background:var(--success-bg);color:var(--success);border:1px solid rgba(34,197,94,.25)}
.btn-success:hover{background:var(--success);color:#000}
.btn-ghost{background:none;color:var(--text2);border:1px solid var(--border)}
.btn-ghost:hover{border-color:var(--text2);color:var(--text)}

.empty-state{text-align:center;padding:28px;color:var(--muted);font-size:.83rem}

input,textarea,select{
  background:#0a0d14;border:1px solid var(--border);border-radius:8px;
  color:var(--text);padding:9px 12px;font-size:.84rem;
  font-family:'Inter',system-ui,sans-serif;
  outline:none;transition:border-color .2s;width:100%;
}
input:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:72px}
.input-row{display:flex;gap:8px}
.input-row input{flex:1}

/* Toggle switch */
.switch{position:relative;display:inline-block;width:38px;height:22px}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;cursor:pointer;inset:0;background:#1f2a3c;border-radius:99px;transition:.2s}
.slider:before{content:'';position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#64748b;border-radius:50%;transition:.2s}
input:checked+.slider{background:rgba(34,197,94,.25)}
input:checked+.slider:before{background:var(--success);transform:translateX(16px)}

/* Console */
#console-out{
  background:#070a10;border-radius:8px;padding:14px;
  font-family:'JetBrains Mono',monospace;font-size:.72rem;
  height:320px;overflow-y:auto;color:#64748b;
  white-space:pre-wrap;word-break:break-all;
  border:1px solid var(--border);
}
.cl{display:block;line-height:1.6;padding:1px 0}
.cl-info{color:#64748b}
.cl-warn{color:var(--warn)}
.cl-error{color:var(--danger)}
.cl-success{color:var(--success)}

/* Toast */
#toast{
  position:fixed;bottom:24px;right:24px;
  background:var(--surface2);border:1px solid var(--border);
  border-radius:10px;padding:11px 16px;
  font-size:.82rem;font-weight:500;
  opacity:0;transition:opacity .25s,transform .25s;
  transform:translateY(8px);pointer-events:none;
  display:flex;align-items:center;gap:8px;max-width:320px;
  box-shadow:0 8px 32px rgba(0,0,0,.4);
}
#toast.show{opacity:1;transform:none}
#toast .ti{width:8px;height:8px;border-radius:50%;flex-shrink:0}

/* Modal */
.modal-overlay{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
  align-items:center;justify-content:center;z-index:100;
}
.modal-overlay.open{display:flex}
.modal{
  background:var(--surface);border:1px solid var(--border);
  border-radius:14px;padding:24px;width:100%;max-width:420px;
  box-shadow:0 20px 60px rgba(0,0,0,.5);
}
.modal h3{font-size:.95rem;font-weight:700;margin-bottom:16px}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
.field-group{margin-bottom:12px}
.field-group label{display:block;font-size:.75rem;font-weight:500;color:var(--text2);margin-bottom:5px}

/* Ping bar */
.ping-bar{display:flex;align-items:center;gap:6px;font-size:.75rem}
.ping-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.ping-good{background:var(--success)}
.ping-med{background:var(--warn)}
.ping-bad{background:var(--danger)}

/* Responsive */
@media(max-width:840px){
  .sidebar{display:none}
  .stats-row{grid-template-columns:1fr 1fr}
}
@media(max-width:520px){
  .stats-row{grid-template-columns:1fr}
}
</style>
</head>
<body>

<!-- Sidebar -->
<aside class="sidebar">
  <div class="sidebar-logo">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#5865f2" opacity=".9"/>
      <path d="M2 17l10 5 10-5" stroke="#5865f2" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M2 12l10 5 10-5" stroke="#5865f2" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".5"/>
    </svg>
    <div class="brand">WebCraft<small>Admin Panel</small></div>
  </div>

  <nav class="nav">
    <div class="nav-section">Overview</div>
    <button class="nav-item active" data-page="overview">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      Overview
    </button>

    <div class="nav-section">Management</div>
    <button class="nav-item" data-page="players">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Players
    </button>
    <button class="nav-item" data-page="bans">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      Ban Manager
    </button>
    <button class="nav-item" data-page="whitelist">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Whitelist
    </button>
    <button class="nav-item" data-page="broadcast">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 16z"/></svg>
      Broadcast
    </button>

    <div class="nav-section">System</div>
    <button class="nav-item" data-page="console">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
      Console
    </button>
  </nav>

  <div class="sidebar-footer">
    <div class="server-badge">
      <div class="dot"></div>
      <div class="info">
        <div class="name">WebCraft Server</div>
        <div class="ver" id="sb-ver">Minecraft ...</div>
      </div>
    </div>
  </div>
</aside>

<!-- Main -->
<div class="main">
  <header class="topbar">
    <div class="topbar-title" id="topbar-title">Overview</div>
    <div class="topbar-right">
      <div class="stat-mini"><span class="val" id="tb-players">0</span><span class="lbl">/ <span id="tb-max">20</span> players</span></div>
      <div class="stat-mini"><span class="val" id="tb-uptime">0s</span><span class="lbl">uptime</span></div>
      <a class="btn-logout" href="/admin/logout">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Logout
      </a>
    </div>
  </header>

  <div class="content">

    <!-- OVERVIEW -->
    <div class="page active" id="page-overview">
      <div class="page-header">
        <h1>Overview</h1>
        <p>Real-time server status and quick actions</p>
      </div>
      <div class="stats-row">
        <div class="stat-card blue">
          <div class="sc-label">Online Players</div>
          <div class="sc-value" id="ov-players">0</div>
          <div class="sc-sub" id="ov-slots">of 20 slots</div>
        </div>
        <div class="stat-card green">
          <div class="sc-label">Server Uptime</div>
          <div class="sc-value" id="ov-uptime">0s</div>
          <div class="sc-sub">since last start</div>
        </div>
        <div class="stat-card warn">
          <div class="sc-label">Active Bans</div>
          <div class="sc-value" id="ov-bans">0</div>
          <div class="sc-sub">total entries</div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Online Players</h2><span id="ov-online-count" style="font-size:.72rem;color:var(--text2)"></span></div>
        <table>
          <thead><tr><th>Player</th><th>Ping</th><th>IP Address</th><th>Actions</th></tr></thead>
          <tbody id="ov-players-body"><tr><td colspan="4" class="empty-state">No players online</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- PLAYERS -->
    <div class="page" id="page-players">
      <div class="page-header">
        <h1>Player Management</h1>
        <p>View and manage online players</p>
      </div>
      <div class="card">
        <div class="card-head"><h2>Online Players</h2></div>
        <table>
          <thead><tr><th>Player</th><th>Ping</th><th>IP Address</th><th>Actions</th></tr></thead>
          <tbody id="pl-players-body"><tr><td colspan="4" class="empty-state">No players online</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- BANS -->
    <div class="page" id="page-bans">
      <div class="page-header">
        <h1>Ban Manager</h1>
        <p>Manage banned players</p>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><h2>Add Ban</h2></div>
        <div class="card-body">
          <div class="input-row">
            <input id="ban-user" placeholder="Username">
            <input id="ban-reason" placeholder="Reason (optional)" style="flex:2">
            <button class="btn btn-danger" onclick="banPlayer()">Ban Player</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Banned Players</h2></div>
        <table>
          <thead><tr><th>Player</th><th>Reason</th><th>Banned By</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody id="bans-body"><tr><td colspan="5" class="empty-state">No active bans</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- WHITELIST -->
    <div class="page" id="page-whitelist">
      <div class="page-header">
        <h1>Whitelist</h1>
        <p>Control who can join the server</p>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-head">
          <h2>Whitelist Status</h2>
          <label class="switch"><input type="checkbox" id="wl-toggle" onchange="wlSetEnabled(this.checked)"><span class="slider"></span></label>
        </div>
        <div class="card-body">
          <div class="input-row">
            <input id="wl-add-user" placeholder="Username to add">
            <button class="btn btn-primary" onclick="wlAdd()">Add Player</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Whitelisted Players</h2></div>
        <table>
          <thead><tr><th>Player</th><th>Actions</th></tr></thead>
          <tbody id="wl-body"><tr><td colspan="2" class="empty-state">Whitelist is empty</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- BROADCAST -->
    <div class="page" id="page-broadcast">
      <div class="page-header">
        <h1>Broadcast</h1>
        <p>Send a message to all online players</p>
      </div>
      <div class="card">
        <div class="card-head"><h2>Send Message</h2></div>
        <div class="card-body">
          <textarea id="bc-msg" placeholder="Type your message here...&#10;Minecraft color codes supported: &a green, &c red, &e yellow..."></textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:10px">
            <button class="btn btn-primary" onclick="broadcast()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send to All
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CONSOLE -->
    <div class="page" id="page-console">
      <div class="page-header">
        <h1>Console</h1>
        <p>Live server output stream</p>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Live Logs</h2>
          <button class="btn btn-ghost btn-sm" onclick="clearConsole()">Clear</button>
        </div>
        <div class="card-body" style="padding:12px">
          <div id="console-out"></div>
        </div>
      </div>
    </div>

  </div><!-- /content -->
</div><!-- /main -->

<!-- Toast -->
<div id="toast"><div class="ti" id="toast-dot"></div><span id="toast-msg"></span></div>

<!-- Kick Modal -->
<div class="modal-overlay" id="modal-kick">
  <div class="modal">
    <h3>Kick Player</h3>
    <div class="field-group"><label>Player</label><input id="kick-who" readonly style="color:var(--text2)"></div>
    <div class="field-group"><label>Reason</label><input id="kick-reason" placeholder="Kicked by admin" autofocus></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('modal-kick')">Cancel</button>
      <button class="btn btn-warn" onclick="doKick()">Kick</button>
    </div>
  </div>
</div>

<!-- Ban Modal -->
<div class="modal-overlay" id="modal-ban">
  <div class="modal">
    <h3>Ban Player</h3>
    <div class="field-group"><label>Player</label><input id="ban-who" readonly style="color:var(--text2)"></div>
    <div class="field-group"><label>Reason</label><input id="ban-reason-modal" placeholder="Banned by admin" autofocus></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('modal-ban')">Cancel</button>
      <button class="btn btn-danger" onclick="doBanModal()">Ban</button>
    </div>
  </div>
</div>

<script>
const TOKEN=document.cookie.replace(/(?:^|.*;)\\s*wc_session\\s*=\\s*([^;]*).*$|^.*$/,'$1');
const H={'Content-Type':'application/json','Authorization':'Bearer '+TOKEN};

// --- Navigation ---
const pages={overview:'Overview',players:'Players',bans:'Ban Manager',whitelist:'Whitelist',broadcast:'Broadcast',console:'Console'};
function nav(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelector('[data-page="'+id+'"]').classList.add('active');
  document.getElementById('topbar-title').textContent=pages[id]||id;
  if(id==='console')startSSE();
}
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click',()=>nav(btn.dataset.page));
});

// --- API ---
async function api(m,u,b){
  const r=await fetch(u,{method:m,headers:H,body:b?JSON.stringify(b):undefined});
  return r.json();
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(s){if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m '+Math.floor(s%60)+'s';return Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m';}
function fmtDate(ts){if(!ts)return '-';const d=new Date(ts);return d.toLocaleDateString()+' '+d.toLocaleTimeString();}

// --- Toast ---
function toast(msg,type='success'){
  const colors={success:'var(--success)',danger:'var(--danger)',warn:'var(--warn)'};
  document.getElementById('toast-dot').style.background=colors[type]||colors.success;
  document.getElementById('toast-msg').textContent=msg;
  const t=document.getElementById('toast');
  t.classList.add('show');
  clearTimeout(t._t);
  t._t=setTimeout(()=>t.classList.remove('show'),3000);
}

// --- Modals ---
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

// --- Ping badge ---
function pingBadge(ping){
  if(!ping)return '<span class="ping-bar"><span class="ping-dot ping-good"></span>-</span>';
  const cls=ping<80?'ping-good':ping<200?'ping-med':'ping-bad';
  return \`<span class="ping-bar"><span class="ping-dot \${cls}"></span>\${ping}ms</span>\`;
}

// --- Player rows ---
function playerRow(p,actions=true){
  const a=actions?\`<button class="btn btn-warn btn-sm" onclick="openKick('\${esc(p.username)}')">Kick</button> <button class="btn btn-danger btn-sm" onclick="openBanModal('\${esc(p.username)}')">Ban</button>\`:'';
  return \`<tr><td><span class="badge badge-online">\${esc(p.username)}</span></td><td>\${pingBadge(p.ping)}</td><td><code style="font-size:.72rem;color:var(--text2)">\${esc(p.ip||'—')}</code></td><td>\${a}</td></tr>\`;
}

// --- Refresh ---
async function refresh(){
  try{
    const [st,pl,bans,wl]=await Promise.all([
      api('GET','/admin/status'),
      api('GET','/admin/players'),
      api('GET','/admin/bans'),
      api('GET','/admin/whitelist'),
    ]);
    // Topbar
    document.getElementById('tb-players').textContent=pl.players.length;
    document.getElementById('tb-max').textContent=st.maxPlayers;
    document.getElementById('tb-uptime').textContent=fmt(st.uptime);
    // Sidebar
    document.getElementById('sb-ver').textContent='Minecraft '+st.version;
    // Overview
    document.getElementById('ov-players').textContent=pl.players.length;
    document.getElementById('ov-slots').textContent='of '+st.maxPlayers+' slots';
    document.getElementById('ov-uptime').textContent=fmt(st.uptime);
    const banCount=Object.keys(bans.bans||{}).length;
    document.getElementById('ov-bans').textContent=banCount;
    document.getElementById('ov-online-count').textContent=pl.players.length+' online';
    // Overview player table
    const ovb=document.getElementById('ov-players-body');
    ovb.innerHTML=pl.players.length?pl.players.map(p=>playerRow(p)).join(''):'<tr><td colspan="4" class="empty-state">No players online</td></tr>';
    // Players page
    const plb=document.getElementById('pl-players-body');
    plb.innerHTML=pl.players.length?pl.players.map(p=>playerRow(p)).join(''):'<tr><td colspan="4" class="empty-state">No players online</td></tr>';
    // Bans
    const bb=document.getElementById('bans-body');
    const be=Object.entries(bans.bans||{});
    bb.innerHTML=be.length?be.map(([n,e])=>\`<tr>
      <td><span class="badge badge-banned">\${esc(n)}</span></td>
      <td style="color:var(--text2)">\${esc(e.reason||'—')}</td>
      <td style="color:var(--muted)">\${esc(e.bannedBy||'—')}</td>
      <td style="color:var(--muted);font-size:.75rem">\${fmtDate(e.at)}</td>
      <td><button class="btn btn-success btn-sm" onclick="unban('\${esc(n)}')">Unban</button></td>
    </tr>\`).join(''):'<tr><td colspan="5" class="empty-state">No active bans</td></tr>';
    // Whitelist
    const wtog=document.getElementById('wl-toggle');
    wtog.checked=!!wl.enabled;
    const wb=document.getElementById('wl-body');
    wb.innerHTML=(wl.players||[]).length?(wl.players||[]).map(p=>\`<tr>
      <td><span class="badge badge-online">\${esc(p)}</span></td>
      <td><button class="btn btn-danger btn-sm" onclick="wlRemove('\${esc(p)}')">Remove</button></td>
    </tr>\`).join(''):'<tr><td colspan="2" class="empty-state">Whitelist is empty</td></tr>';
  }catch(e){console.error(e);}
}

// --- Actions ---
function openKick(u){document.getElementById('kick-who').value=u;document.getElementById('kick-reason').value='';openModal('modal-kick');setTimeout(()=>document.getElementById('kick-reason').focus(),50);}
async function doKick(){
  const u=document.getElementById('kick-who').value;
  const r=document.getElementById('kick-reason').value||'Kicked by admin';
  const d=await api('POST','/admin/kick/'+encodeURIComponent(u),{reason:r});
  closeModal('modal-kick');
  d.error?toast(d.error,'danger'):toast('Kicked '+u);
  refresh();
}

function openBanModal(u){document.getElementById('ban-who').value=u;document.getElementById('ban-reason-modal').value='';openModal('modal-ban');setTimeout(()=>document.getElementById('ban-reason-modal').focus(),50);}
async function doBanModal(){
  const u=document.getElementById('ban-who').value;
  const r=document.getElementById('ban-reason-modal').value||'Banned by admin';
  const d=await api('POST','/admin/ban/'+encodeURIComponent(u),{reason:r});
  closeModal('modal-ban');
  d.error?toast(d.error,'danger'):toast('Banned '+u,'warn');
  refresh();
}

async function banPlayer(){
  const u=document.getElementById('ban-user').value.trim();
  const r=document.getElementById('ban-reason').value.trim()||'Banned by admin';
  if(!u)return toast('Enter a username','danger');
  const d=await api('POST','/admin/ban/'+encodeURIComponent(u),{reason:r});
  d.error?toast(d.error,'danger'):toast('Banned '+u,'warn');
  document.getElementById('ban-user').value='';
  document.getElementById('ban-reason').value='';
  refresh();
}

async function unban(u){
  const d=await api('POST','/admin/unban/'+encodeURIComponent(u),{});
  d.error?toast(d.error,'danger'):toast('Unbanned '+u);
  refresh();
}

async function broadcast(){
  const m=document.getElementById('bc-msg').value.trim();
  if(!m)return toast('Message is empty','danger');
  const d=await api('POST','/admin/broadcast',{message:m});
  d.error?toast(d.error,'danger'):toast('Broadcast sent to all players');
  document.getElementById('bc-msg').value='';
}

async function wlSetEnabled(val){
  await api('POST','/admin/whitelist/'+(val?'on':'off'),{});
  toast('Whitelist '+(val?'enabled':'disabled'),val?'success':'warn');
}
async function wlAdd(){
  const u=document.getElementById('wl-add-user').value.trim();
  if(!u)return toast('Enter a username','danger');
  const d=await api('POST','/admin/whitelist/add',{username:u});
  d.error?toast(d.error,'danger'):toast('Added '+u+' to whitelist');
  document.getElementById('wl-add-user').value='';
  refresh();
}
async function wlRemove(u){
  const d=await api('POST','/admin/whitelist/remove',{username:u});
  d.error?toast(d.error,'danger'):toast('Removed '+u+' from whitelist','warn');
  refresh();
}

// --- Console SSE ---
let sseStarted=false;
function startSSE(){
  if(sseStarted)return;
  sseStarted=true;
  const out=document.getElementById('console-out');
  const es=new EventSource('/admin/logs');
  es.onmessage=e=>{
    const line=JSON.parse(e.data);
    const span=document.createElement('span');
    span.className='cl '+(line.includes('ERROR')?'cl-error':line.includes('WARN')?'cl-warn':line.includes('INFO')?'cl-info':'cl-info');
    span.textContent=line+'\n';
    out.appendChild(span);
    if(out.children.length>300)out.removeChild(out.firstChild);
    out.scrollTop=out.scrollHeight;
  };
}
function clearConsole(){document.getElementById('console-out').innerHTML='';}

refresh();
setInterval(refresh,5000);
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
//  Server
// ---------------------------------------------------------------------------
function startAdminServer(mcServer) {
  return new Promise((resolve, reject) => {
    _adminServer = http.createServer(async (req, res) => {
      const url    = req.url.split('?')[0];
      const method = req.method;

      if (method === 'GET' && url === '/admin/login') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(loginHtml(false));
      }
      if (method === 'POST' && url === '/admin/login') {
        const form = await readForm(req);
        if (!config.ADMIN_TOKEN || form.token === config.ADMIN_TOKEN) {
          const sid = randomToken();
          SESSIONS.add(sid);
          setTimeout(() => SESSIONS.delete(sid), 8 * 3600 * 1000);
          res.writeHead(302, { 'Set-Cookie': `wc_session=${sid}; HttpOnly; Path=/; SameSite=Strict`, Location: '/' });
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(loginHtml(true));
      }
      if (url === '/admin/logout') {
        SESSIONS.delete(parseCookies(req).wc_session);
        res.writeHead(302, { 'Set-Cookie': 'wc_session=; Max-Age=0; Path=/', Location: '/admin/login' });
        return res.end();
      }

      if (!isAuthenticated(req)) {
        const isApi = req.headers['authorization'] || req.headers['content-type'] === 'application/json';
        if (isApi) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
        res.writeHead(302, { Location: '/admin/login' }); return res.end();
      }

      if (method === 'GET' && (url === '/' || url === '/admin')) {
        res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(dashboardHtml());
      }

      if (method === 'GET' && url === '/admin/logs') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        for (const line of logBuffer) res.write(`data: ${JSON.stringify(line)}\n\n`);
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      if (method === 'GET' && url === '/admin/status')
        return json(res, 200, { uptime: Math.floor(process.uptime()), players: Object.values(mcServer.players || {}).map((p) => p.username), maxPlayers: config.MAX_PLAYERS, version: config.MC_VERSION, onlineMode: config.ONLINE_MODE });

      if (method === 'GET' && url === '/admin/players')
        return json(res, 200, { players: Object.values(mcServer.players || {}).map((p) => ({ username: p.username, ping: p.ping, ip: p.socket?.remoteAddress })) });

      if (method === 'GET' && url === '/admin/bans') return json(res, 200, { bans: getBans() });

      const kickMatch  = url.match(/^\/admin\/kick\/(.+)$/);
      const banMatch   = url.match(/^\/admin\/ban\/(.+)$/);
      const unbanMatch = url.match(/^\/admin\/unban\/(.+)$/);

      if (method === 'POST' && kickMatch) {
        const username = decodeURIComponent(kickMatch[1]);
        const body = await readBody(req);
        const reason = body.reason || 'Kicked by admin';
        const player = Object.values(mcServer.players || {}).find((p) => p.username === username);
        if (!player) return json(res, 404, { error: `Player "${username}" not found` });
        player.kick(reason); log.info(`Kicked ${username}: ${reason}`);
        return json(res, 200, { kicked: username, reason });
      }

      if (method === 'POST' && banMatch) {
        const username = decodeURIComponent(banMatch[1]);
        const body = await readBody(req);
        const reason = body.reason || 'Banned via admin dashboard';
        writeBan(username, reason, null, 'admin-dashboard');
        const player = Object.values(mcServer.players || {}).find((p) => p.username.toLowerCase() === username.toLowerCase());
        if (player) player.kick(`Banned: ${reason}`);
        log.info(`Banned ${username}: ${reason}`);
        return json(res, 200, { banned: username, reason });
      }

      if (method === 'POST' && unbanMatch) {
        const username = decodeURIComponent(unbanMatch[1]);
        removeBan(username); log.info(`Unbanned ${username}`);
        return json(res, 200, { unbanned: username });
      }

      if (method === 'POST' && url === '/admin/broadcast') {
        const body = await readBody(req);
        if (!body.message) return json(res, 400, { error: '"message" field required' });
        mcServer.broadcast(body.message); log.info(`Broadcast: ${body.message}`);
        return json(res, 200, { broadcast: body.message });
      }

      if (method === 'GET' && url === '/admin/whitelist') {
        const wl = getWhitelistApi(mcServer);
        if (!wl) return json(res, 200, { enabled: false, players: [] });
        return json(res, 200, { enabled: wl.isEnabled(), players: wl.getList() });
      }
      if (method === 'POST' && url === '/admin/whitelist/on') {
        const wl = getWhitelistApi(mcServer); if (wl) wl.setEnabled(true);
        return json(res, 200, { enabled: true });
      }
      if (method === 'POST' && url === '/admin/whitelist/off') {
        const wl = getWhitelistApi(mcServer); if (wl) wl.setEnabled(false);
        return json(res, 200, { enabled: false });
      }
      if (method === 'POST' && url === '/admin/whitelist/add') {
        const wl = getWhitelistApi(mcServer);
        const body = await readBody(req);
        if (!body.username) return json(res, 400, { error: '"username" required' });
        if (wl) wl.add(body.username);
        return json(res, 200, { added: body.username });
      }
      if (method === 'POST' && url === '/admin/whitelist/remove') {
        const wl = getWhitelistApi(mcServer);
        const body = await readBody(req);
        if (!body.username) return json(res, 400, { error: '"username" required' });
        if (wl) wl.remove(body.username);
        return json(res, 200, { removed: body.username });
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
