/**
 * tests/plugins.test.js
 * Unit tests for the plugin loader (load order, skip list, error handling).
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');

describe('plugin loader — sortPluginFiles', () => {
  // Access the private sortPluginFiles via module internals
  // We test it indirectly by mocking a temp plugins directory

  let tmpDir;
  let config;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webcraft-test-'));
    process.env.PLUGINS_DIR = tmpDir;
    // Provide a minimal LOG_LEVEL so logger is quiet
    process.env.LOG_LEVEL = 'ERROR';
    config = require('../src/config');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.PLUGINS_DIR;
  });

  test('loads plugins in numeric prefix order', () => {
    const order = [];
    const makePlugin = (name) => `module.exports = function() { global.__testOrder = global.__testOrder || []; global.__testOrder.push('${name}'); };`;

    fs.writeFileSync(path.join(tmpDir, '02-second.js'), makePlugin('second'));
    fs.writeFileSync(path.join(tmpDir, '01-first.js'),  makePlugin('first'));
    fs.writeFileSync(path.join(tmpDir, '03-third.js'),  makePlugin('third'));

    global.__testOrder = [];
    const { loadPlugins } = require('../src/plugins');
    loadPlugins({});
    expect(global.__testOrder).toEqual(['first', 'second', 'third']);
    delete global.__testOrder;
  });

  test('skips core-api.js automatically', () => {
    fs.writeFileSync(path.join(tmpDir, 'core-api.js'), 'module.exports = function() { throw new Error("should not load"); };');
    fs.writeFileSync(path.join(tmpDir, 'valid.js'),    'module.exports = function() {};');
    const { loadPlugins } = require('../src/plugins');
    expect(() => loadPlugins({})).not.toThrow();
  });

  test('does not throw when a plugin crashes', () => {
    fs.writeFileSync(path.join(tmpDir, 'bad.js'), 'module.exports = function() { throw new Error("boom"); };');
    const { loadPlugins } = require('../src/plugins');
    expect(() => loadPlugins({})).not.toThrow();
  });

  test('returns empty array when plugins dir is missing', () => {
    process.env.PLUGINS_DIR = path.join(tmpDir, 'nonexistent');
    jest.resetModules();
    const { loadPlugins } = require('../src/plugins');
    expect(loadPlugins({})).toEqual([]);
  });
});
