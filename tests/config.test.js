/**
 * tests/config.test.js
 * Unit tests for the config module.
 */

'use strict';

describe('config', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    // Restore env and clear module cache so config is re-evaluated each test
    Object.keys(process.env).forEach((k) => delete process.env[k]);
    Object.assign(process.env, ORIGINAL_ENV);
    jest.resetModules();
  });

  test('loads default values when env is not set', () => {
    // Remove relevant vars
    delete process.env.WS_PORT;
    delete process.env.MC_PORT;
    delete process.env.MC_VERSION;
    delete process.env.ONLINE_MODE;
    delete process.env.MAX_PLAYERS;
    delete process.env.VIEW_DISTANCE;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.ADMIN_PORT;
    delete process.env.AUTOSAVE_MIN;

    jest.resetModules();
    const config = require('../src/config');

    expect(config.WS_PORT).toBe(8080);
    expect(config.MC_PORT).toBe(25565);
    expect(config.MC_VERSION).toBe('1.20.4');
    expect(config.ONLINE_MODE).toBe(true);
    expect(config.MAX_PLAYERS).toBe(20);
    expect(config.VIEW_DISTANCE).toBe(8);
    expect(config.RATE_LIMIT_MAX).toBe(10);
    expect(config.ADMIN_PORT).toBe(9090);
    expect(config.AUTOSAVE_MIN).toBe(5);
  });

  test('reads integer env vars correctly', () => {
    process.env.WS_PORT = '9000';
    process.env.MAX_PLAYERS = '50';
    jest.resetModules();
    const config = require('../src/config');
    expect(config.WS_PORT).toBe(9000);
    expect(config.MAX_PLAYERS).toBe(50);
  });

  test('throws on invalid integer', () => {
    process.env.WS_PORT = 'not-a-number';
    jest.resetModules();
    expect(() => require('../src/config')).toThrow();
  });

  test('reads ONLINE_MODE=false correctly', () => {
    process.env.ONLINE_MODE = 'false';
    jest.resetModules();
    const config = require('../src/config');
    expect(config.ONLINE_MODE).toBe(false);
  });

  test('throws on invalid boolean', () => {
    process.env.ONLINE_MODE = 'yes';
    jest.resetModules();
    expect(() => require('../src/config')).toThrow();
  });
});
