/**
 * plugins.js
 * Plugin loader — scans PLUGINS_DIR for *.js files and loads each one.
 *
 * A plugin is a JS file that exports a function:
 *   module.exports = function(server, config) { ... }
 *
 * The server instance is the flying-squid server object.
 * Plugins can listen to server events, register commands, etc.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const log    = require('./logger')('Plugins');
const config = require('./config');

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

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

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
      log.info(`Loaded plugin: ${file}`);
      loaded.push(file);
    } catch (err) {
      log.error(`Failed to load plugin ${file}:`, err.message);
    }
  }

  return loaded;
}

module.exports = { loadPlugins };
