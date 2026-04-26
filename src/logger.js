/**
 * logger.js
 * Minimal structured logger with timestamps and log levels.
 * Drop-in replacement for console.log / console.error.
 *
 * Usage:
 *   const log = require('./logger')('WS');
 *   log.info('Bridge started on :8080');
 *   log.warn('Rate limited: 1.2.3.4');
 *   log.error('Unexpected error', err);
 */

'use strict';

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

function timestamp() {
  return new Date().toISOString();
}

function createLogger(namespace) {
  return {
    debug: (...args) => {
      if (MIN_LEVEL <= LEVELS.DEBUG)
        console.debug(`${timestamp()} [DEBUG] [${namespace}]`, ...args);
    },
    info: (...args) => {
      if (MIN_LEVEL <= LEVELS.INFO)
        console.log(`${timestamp()} [INFO]  [${namespace}]`, ...args);
    },
    warn: (...args) => {
      if (MIN_LEVEL <= LEVELS.WARN)
        console.warn(`${timestamp()} [WARN]  [${namespace}]`, ...args);
    },
    error: (...args) => {
      if (MIN_LEVEL <= LEVELS.ERROR)
        console.error(`${timestamp()} [ERROR] [${namespace}]`, ...args);
    },
  };
}

module.exports = createLogger;
