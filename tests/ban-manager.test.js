/**
 * tests/ban-manager.test.js
 * Integration tests for ban-manager plugin logic.
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');

describe('ban-manager plugin', () => {
  let tmpDir;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webcraft-bans-'));
    // Redirect data dir
    jest.mock('../plugins/core-api', () => ({
      ...jest.requireActual('../plugins/core-api'),
      ensureDir: () => tmpDir,
    }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.unmock('../plugins/core-api');
  });

  function buildServer() {
    const listeners = {};
    const commands  = new Map();
    return {
      players: {},
      on: (event, fn) => { listeners[event] = listeners[event] || []; listeners[event].push(fn); },
      emit: (event, ...args) => (listeners[event] || []).forEach((fn) => fn(...args)),
      registerCommand: (name, meta, fn) => commands.set(name, fn),
      getCommands: () => [],
      __commands: commands,
      webcraft: { perms: { hasPermission: () => true } },
    };
  }

  test('banned player is kicked on login', () => {
    const server = buildServer();
    require('../plugins/ban-manager')(server);

    const kicked = [];
    const client = { username: 'Griefer', kick: (msg) => kicked.push(msg) };

    // Ban first, then trigger login
    server.__commands.get('ban')({ client: { username: 'Admin' }, args: ['Griefer', 'griefing'], reply: () => {} });
    server.emit('login', client);

    expect(kicked.length).toBe(1);
    expect(kicked[0]).toMatch(/griefing/);
  });

  test('unban removes the ban entry', () => {
    const server = buildServer();
    require('../plugins/ban-manager')(server);

    const adminClient = { username: 'Admin', kick: () => {} };
    server.__commands.get('ban')({ client: adminClient, args: ['Steve', 'spam'], reply: () => {} });
    server.__commands.get('unban')({ client: adminClient, args: ['Steve'], reply: () => {} });

    const kicks = [];
    const steve = { username: 'Steve', kick: (m) => kicks.push(m) };
    server.emit('login', steve);
    expect(kicks.length).toBe(0);
  });

  test('tempban expires after duration', (done) => {
    jest.useFakeTimers();
    const server = buildServer();
    require('../plugins/ban-manager')(server);

    const adminClient = { username: 'Admin', kick: () => {} };
    server.__commands.get('tempban')({
      client: adminClient,
      args: ['TempPlayer', '1s', 'testing'],
      reply: () => {},
    });

    // Advance time by 2 seconds
    jest.advanceTimersByTime(2000);

    const kicks = [];
    const client = { username: 'TempPlayer', kick: (m) => kicks.push(m) };
    server.emit('login', client);
    expect(kicks.length).toBe(0); // ban expired
    jest.useRealTimers();
    done();
  });
});
