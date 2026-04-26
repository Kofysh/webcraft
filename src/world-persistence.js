/**
 * world-persistence.js
 * Auto-saves the world to disk every AUTOSAVE_MIN minutes.
 * Uses a simple JSON-based persistence layer compatible with prismarine-world.
 *
 * For full Anvil (Minecraft region) format support, swap the read/write
 * functions with prismarine-provider-anvil once that package is stable.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const log    = require('./logger')('World');
const config = require('./config');

let _saveInterval = null;

/**
 * Ensure the world directory exists.
 */
function ensureWorldDir() {
  const dir = path.resolve(config.WORLD_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info(`Created world directory: ${dir}`);
  }
  return dir;
}

/**
 * Start auto-saving the world every AUTOSAVE_MIN minutes.
 * @param {object} server  flying-squid server instance
 */
function startAutosave(server) {
  const dir      = ensureWorldDir();
  const interval = config.AUTOSAVE_MIN * 60 * 1000;

  log.info(`Auto-save every ${config.AUTOSAVE_MIN} min → ${dir}`);

  _saveInterval = setInterval(async () => {
    try {
      await saveWorld(server, dir);
    } catch (err) {
      log.error('Auto-save failed:', err.message);
    }
  }, interval);

  _saveInterval.unref(); // don't block process exit
}

/**
 * Persist loaded chunks to disk as JSON files.
 * One file per chunk: world/<x>_<z>.json
 * @param {object} server
 * @param {string} dir
 */
async function saveWorld(server, dir) {
  let saved = 0;

  if (!server.overworld || !server.overworld.columns) {
    log.debug('No loaded chunks to save');
    return;
  }

  for (const [key, column] of Object.entries(server.overworld.columns)) {
    const filePath = path.join(dir, `${key}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(column.toJson()), 'utf8');
      saved++;
    } catch (err) {
      log.warn(`Failed to save chunk ${key}:`, err.message);
    }
  }

  if (saved > 0) log.info(`Auto-saved ${saved} chunk(s)`);
}

/**
 * Stop the auto-save interval (called on graceful shutdown).
 */
function stopAutosave() {
  if (_saveInterval) {
    clearInterval(_saveInterval);
    _saveInterval = null;
    log.info('Auto-save stopped');
  }
}

module.exports = { startAutosave, stopAutosave };
