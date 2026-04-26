#!/usr/bin/env node
/**
 * webcraft-proxy
 * Run this once on the player's machine.
 * Opens TCP :25565 locally → tunnels to the WebCraft WSS server.
 *
 * Usage: npx webcraft-proxy wss://your-server.example.com:8080
 */

'use strict';

const net       = require('net');
const WebSocket = require('ws');

const WS_URL   = process.argv[2];
const TCP_PORT = parseInt(process.argv[3]) || 25565;

if (!WS_URL) {
  console.error('Usage: webcraft-proxy <wss://server-url:port> [local-tcp-port]');
  console.error('Example: webcraft-proxy wss://myserver.example.com:8080');
  process.exit(1);
}

const tcpServer = net.createServer((socket) => {
  const ip = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[Proxy] Minecraft client connected (${ip})`);

  const ws = new WebSocket(WS_URL, { binary: true });

  ws.on('open', () => console.log(`[Proxy] WebSocket connected to ${WS_URL}`));

  socket.on('data', (chunk) => { if (ws.readyState === WebSocket.OPEN) ws.send(chunk); });
  ws.on('message', (data)   => { if (socket.writable) socket.write(data); });

  socket.on('close', ()  => { if (ws.readyState !== WebSocket.CLOSED) ws.close(); });
  socket.on('error', (e) => { console.error('[Proxy] TCP error:', e.message); ws.close(); });
  ws.on('close', ()      => { if (!socket.destroyed) socket.destroy(); });
  ws.on('error', (e)     => { console.error('[Proxy] WS error:', e.message); socket.destroy(); });
});

tcpServer.listen(TCP_PORT, '127.0.0.1', () => {
  console.log('');
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│         webcraft-proxy  ─  running ✅           │');
  console.log('├─────────────────────────────────────────────────┤');
  console.log(`│  Listening : 127.0.0.1:${TCP_PORT}                    │`);
  console.log(`│  Forwarding: ${WS_URL}`);
  console.log('├─────────────────────────────────────────────────┤');
  console.log('│  Add server in Minecraft: 127.0.0.1             │');
  console.log('└─────────────────────────────────────────────────┘');
  console.log('');
});