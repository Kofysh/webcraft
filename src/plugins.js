/**
 * plugins.js
 * Plugin loader — scans PLUGINS_DIR for *.js files and loads each one.
 *
 * Load order rules (applied in sequence):
 *  1. Files prefixed with a number (00-, 01-, ...) are loaded first, in numeric order.
 *  2. core-api.js is always skipped here — it is a library, not a plugin.
 *  3. Remaining files are loaded alphabetically.
 *
 * A plugin exports a single function:
 *   module.exports = function(server, config) { ... }
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const log    = require('./logger')('Plugins');
const config = require('./config');

// These filenames are helpers, not plugins — never auto-loaded
const SKIP = new Set(['core-api.js']);

function sortPluginFiles(files) {
  const numbered = [];
  const rest     = [];

  for (const f of files) {
    if (SKIP.has(f)) continue;
    if (/^\d+[-_]/.test(f)) numbered.push(f);
    else rest.push(f);
  }

  numbered.sort((a, b) => {
    const na = parseInt(a);
    const nb = parseInt(b);
    return na - nb;
  });

  rest.sort();
  return [...numbered, ...rest];
}

/**
 * Load all plugins from PLUGINS_DIR.
 * @param {object} server  flying-squid server instance
 * @returns {string[]}     list of loaded plugin names
 */
function loadPlugins(server) {
  const dir = path.resolve(config.PLUGINS_DIR);

  if (!fs.existsSync(dir)) {
    log.info(`Plugins directory not found (${dir}) — skipping`);
    return [];
  }

  const raw   = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('.'));
  const files = sortPluginFiles(raw);

  if (files.length === 0) {
    log.info('No plugins found');
    return [];
  }

  const loaded = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const plugin = require(fullPath);
      if (typeof plugin !== 'function') {
        log.warn(`${file} does not export a function — skipped`);
        continue;
      }
      plugin(server, config);
      log.info(`Loaded: ${file}`);
      loaded.push(file);
    } catch (err) {
      log.error(`Failed to load ${file}: ${err.message}`);
    }
  }

  return loaded;
}

module.exports = { loadPlugins };
