# 🧱 WebCraft

> A Minecraft server that runs on **standard web hosting** — no dedicated server, no port 25565 exposed, no VPS required.

## How does it work?

Standard web hosting only allows HTTP/HTTPS traffic.  
Minecraft normally requires a raw TCP connection on port 25565.

WebCraft solves this with a two-part architecture:

```
Player's PC                        Web Hosting (any Node.js host)
──────────────────────────────     ──────────────────────────────────
Minecraft Client                   ┌──────────────────────────────┐
   └─► TCP :25565 (local)          │  WebCraft Server             │
         │                         │                              │
webcraft-proxy    ──── WSS ────────►│  WS Bridge  →  flying-squid │
(run once locally)                 │  :8080      →  :25565 (lo)  │
                                   └──────────────────────────────┘
```

1. **Server side** — Node.js runs `flying-squid` bound to `127.0.0.1` + a public WebSocket bridge on port 8080.
2. **Client side** — players run `webcraft-proxy` once. It opens TCP 25565 locally and tunnels traffic over WSS.

---

## Quick Start

```bash
git clone https://github.com/Kofysh/webcraft
cd webcraft
npm install
node src/index.js
```

Players connect with:
```bash
npx webcraft-proxy wss://your-domain.com:8080
```
Then add `127.0.0.1` in Minecraft.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8080` | Public WebSocket port |
| `MC_PORT` | `25565` | Internal Minecraft port (loopback) |
| `MC_VERSION` | `1.20.4` | Minecraft version |
| `ONLINE_MODE` | `true` | Require Mojang authentication |
| `MAX_PLAYERS` | `20` | Maximum simultaneous players |
| `VIEW_DISTANCE` | `8` | Render distance (chunks) |
| `MOTD` | `§aWebCraft...` | Server list message |

---

## Deploy (no Docker)

### Railway
1. Connect this repo
2. Runtime: **Node.js**, start command: `node src/index.js`
3. Port: `8080`

### Render
1. New **Web Service** → connect repo
2. Build: `npm install`, Start: `node src/index.js`, Port: `8080`

### Fly.io
```bash
fly launch && fly deploy
```

---

## Project Structure

```
webcraft/
├── src/
│   ├── index.js            # Entry point
│   ├── minecraft-server.js # flying-squid wrapper (internal, loopback only)
│   └── ws-bridge.js        # WebSocket ↔ TCP bridge (public)
├── proxy/
│   ├── index.js            # webcraft-proxy (run by players locally)
│   └── package.json
└── package.json
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © 2026 — see [LICENSE](LICENSE)