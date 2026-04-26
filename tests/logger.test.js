/**
 * tests/logger.test.js
 * Unit tests for the logger module.
 */

'use strict';

describe('logger', () => {
  beforeEach(() => jest.resetModules());

  test('createLogger returns object with info/warn/error/debug', () => {
    const createLogger = require('../src/logger');
    const log = createLogger('Test');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  test('info does not throw', () => {
    const createLogger = require('../src/logger');
    const log = createLogger('Test');
    expect(() => log.info('hello')).not.toThrow();
  });

  test('error does not throw with Error object', () => {
    const createLogger = require('../src/logger');
    const log = createLogger('Test');
    expect(() => log.error('oops', new Error('boom'))).not.toThrow();
  });
});
