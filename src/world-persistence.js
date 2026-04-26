/**
 * world-persistence.js
 * Auto-saves loaded chunks to disk every AUTOSAVE_MIN minutes.
 *
 * Storage format: one JSON file per chunk key in WORLD_DIR.
 * Uses defensive checks — gracefully skips chunks that don’t support serialisation.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const log    = require('./logger')('World');
const config = require('./config');

let _saveInterval = null;

function ensureWorldDir() {
  const dir = path.resolve(config.WORLD_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info(`Created world directory: ${dir}`);
  }
  return dir;
}

function startAutosave(server) {
  const dir      = ensureWorldDir();
  const interval = config.AUTOSAVE_MIN * 60 * 1000;

  log.info(`Auto-save every ${config.AUTOSAVE_MIN} min → ${path.resolve(config.WORLD_DIR)}`);

  _saveInterval = setInterval(async () => {
    try { await saveWorld(server, dir); }
    catch (err) { log.error('Auto-save failed:', err.message); }
  }, interval);

  _saveInterval.unref();
}

async function saveWorld(server, dir) {
  // Support both flying-squid’s overworld.columns and a plain columns map
  const columns =
    server?.overworld?.columns ??
    server?.world?.columns ??
    null;

  if (!columns || typeof columns !== 'object') {
    log.debug('No loaded chunks to save (world not initialised yet)');
    return;
  }

  let saved = 0;
  let skipped = 0;

  for (const [key, column] of Object.entries(columns)) {
    const filePath = path.join(dir, `${key}.json`);
    try {
      let data;
      if (typeof column.toJson  === 'function') data = column.toJson();
      else if (typeof column.dump === 'function') data = column.dump();
      else { skipped++; continue; }

      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
      saved++;
    } catch (err) {
      log.warn(`Failed to save chunk ${key}: ${err.message}`);
    }
  }

  if (saved > 0 || skipped > 0)
    log.info(`Auto-saved ${saved} chunk(s)${skipped ? `, skipped ${skipped}` : ''}`);
}

function stopAutosave() {
  if (_saveInterval) {
    clearInterval(_saveInterval);
    _saveInterval = null;
    log.info('Auto-save stopped');
  }
}

module.exports = { startAutosave, stopAutosave };
