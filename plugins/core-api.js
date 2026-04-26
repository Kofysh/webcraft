/**
 * core-api.js
 * Shared helpers for WebCraft plugins.
 *
 * Provides:
 *  - chat / system messaging helpers
 *  - JSON persistence helpers
 *  - command registration + dispatch
 *  - basic player lookup utilities
 */

'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  const full = path.resolve(dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  return full;
}

function loadJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function textPacket(text) {
  return {
    message: JSON.stringify({ text }),
    position: 0,
    sender: '00000000-0000-0000-0000-000000000000',
  };
}

function sendChat(client, text) {
  try {
    client.write('chat', textPacket(text));
  } catch (_) {}
}

function broadcast(server, text) {
  const players = Object.values(server.players || {});
  for (const p of players) sendChat(p, text);
}

function getOnlinePlayers(server) {
  return Object.values(server.players || {});
}

function findPlayer(server, username) {
  return getOnlinePlayers(server).find(
    (p) => p.username.toLowerCase() === String(username).toLowerCase()
  );
}

function installCommandBus(server) {
  if (server.__webcraftCommandsInstalled) return server.__webcraftCommands;

  const commands = new Map();

  server.registerCommand = (name, meta, handler) => {
    commands.set(name.toLowerCase(), {
      name: name.toLowerCase(),
      description: meta?.description || 'No description',
      usage: meta?.usage || `/${name}`,
      permission: meta?.permission || null,
      handler,
    });
  };

  server.getCommands = () => Array.from(commands.values());
  server.__webcraftCommands = commands;
  server.__webcraftCommandsInstalled = true;

  server.on('chat', (client, message) => {
    if (!message || typeof message !== 'string') return;
    if (!message.startsWith('/')) return;

    const parts = message.slice(1).trim().split(/\s+/);
    const cmdName = (parts.shift() || '').toLowerCase();
    const cmd = commands.get(cmdName);
    if (!cmd) {
      sendChat(client, `§cUnknown command: /${cmdName}`);
      return;
    }

    try {
      cmd.handler({
        server,
        client,
        args: parts,
        command: cmd,
        reply: (msg) => sendChat(client, msg),
        broadcast: (msg) => broadcast(server, msg),
        findPlayer: (name) => findPlayer(server, name),
      });
    } catch (err) {
      sendChat(client, `§cCommand error: ${err.message}`);
    }
  });

  return commands;
}

module.exports = {
  ensureDir,
  loadJson,
  saveJson,
  sendChat,
  broadcast,
  findPlayer,
  getOnlinePlayers,
  installCommandBus,
};
