/**
 * config.js
 * Centralised config — validates all environment variables at startup.
 * Fails fast with a clear error message instead of silently using bad defaults.
 */

'use strict';

function required(key) {
  const v = process.env[key];
  if (v === undefined || v === '') {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return v;
}

function int(key, def) {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`[Config] ${key} must be an integer, got: "${v}"`);
  return n;
}

function bool(key, def) {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  if (v === 'true')  return true;
  if (v === 'false') return false;
  throw new Error(`[Config] ${key} must be "true" or "false", got: "${v}"`);
}

const config = {
  // WebSocket bridge
  WS_PORT:        int('WS_PORT', 8080),
  CERT_PATH:      process.env.CERT_PATH  || null,  // optional TLS
  KEY_PATH:       process.env.KEY_PATH   || null,

  // Internal Minecraft server
  MC_PORT:        int('MC_PORT', 25565),
  MC_VERSION:     process.env.MC_VERSION || '1.20.6',
  ONLINE_MODE:    bool('ONLINE_MODE', true),
  MAX_PLAYERS:    int('MAX_PLAYERS', 20),
  VIEW_DISTANCE:  int('VIEW_DISTANCE', 8),
  MOTD:           process.env.MOTD || '\u00a7aWebCraft \u00a77\u2014 hosted on the web \u2728',

  // Security
  RATE_LIMIT_MAX: int('RATE_LIMIT_MAX', 10),

  // World persistence
  WORLD_DIR:      process.env.WORLD_DIR  || './world',
  AUTOSAVE_MIN:   int('AUTOSAVE_MIN', 5),

  // Admin API (internal only, never exposed publicly)
  ADMIN_PORT:     int('ADMIN_PORT', 9090),
  ADMIN_TOKEN:    process.env.ADMIN_TOKEN || null,

  // Plugins
  PLUGINS_DIR:    process.env.PLUGINS_DIR || './plugins',
};

module.exports = config;
