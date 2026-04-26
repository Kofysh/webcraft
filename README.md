# 🧱 WebCraft

> A Minecraft server that runs on **any machine with Node.js** — no VPS, no Docker, no cloud platform required.

## How does it work?

Minecraft normally requires raw TCP on port 25565.  
WebCraft wraps the server behind a **WebSocket bridge** so it can run anywhere Node.js is available — including machines that only expose HTTP/HTTPS ports.

```
Player's PC                        Any Node.js host
────────────────────────────     ─────────────────────────────────
Minecraft Client                   ┌────────────────────────────┐
   └─► TCP :25565 (local)          │  WebCraft                    │
         │                         │                              │
webcraft-proxy    ──── WSS ────────►│  WS Bridge  →  flying-squid │
(run once on PC)                   │  :8080      →  :25565 (lo)  │
                                   └────────────────────────────┘
```

---

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/Kofysh/webcraft/main/scripts/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/Kofysh/webcraft.git
cd webcraft
npm install
cp .env.example .env   # then edit .env
node src/index.js
```

---

## Players connect

Each player runs **once** on their own machine:
```bash
npx webcraft-proxy wss://your-host.example.com:8080
```
Then adds `127.0.0.1` as a server in Minecraft.

---

## Configuration

All settings live in `.env` (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8080` | Public WebSocket port |
| `CERT_PATH` | — | Path to TLS certificate (enables WSS) |
| `KEY_PATH` | — | Path to TLS private key |
| `MC_PORT` | `25565` | Internal Minecraft port (loopback only) |
| `MC_VERSION` | `1.20.4` | Minecraft version |
| `ONLINE_MODE` | `true` | Require Mojang auth |
| `MAX_PLAYERS` | `20` | Slot limit |
| `VIEW_DISTANCE` | `8` | Render distance (chunks) |
| `MOTD` | see `.env.example` | Server list message |
| `RATE_LIMIT_MAX` | `10` | Max WS connections per IP per minute |
| `ADMIN_PORT` | `9090` | Internal admin API port |
| `ADMIN_TOKEN` | — | Bearer token for admin API |
| `WORLD_DIR` | `./world` | World save directory |
| `AUTOSAVE_MIN` | `5` | Auto-save interval (minutes) |
| `PLUGINS_DIR` | `./plugins` | Plugins directory |
| `LOG_LEVEL` | `INFO` | Log level (DEBUG/INFO/WARN/ERROR) |

---

## Plugins

Place any `.js` file in the `plugins/` directory. Each plugin exports a single function:

```js
module.exports = function(server, config) {
  server.on('login', (client) => {
    client.write('chat', { message: JSON.stringify({ text: 'Hello!' }), position: 1 });
  });
};
```

Two example plugins are included: `plugins/hello.js` and `plugins/motd-rotator.js`.

---

## Admin API

Listens on `127.0.0.1:ADMIN_PORT` (never exposed publicly).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/status` | Server status + player list |
| GET | `/admin/players` | Online players with ping + IP |
| POST | `/admin/kick/:username` | Kick a player (`{ "reason": "..." }`) |
| POST | `/admin/broadcast` | Broadcast a message (`{ "message": "..." }`) |

Secure with `ADMIN_TOKEN` env var — requests need `Authorization: Bearer <token>`.

---

## TLS / WSS

Set `CERT_PATH` and `KEY_PATH` in `.env` to enable WSS (encrypted WebSocket):

```bash
# Free cert with certbot
certbot certonly --standalone -d your-domain.com
```

Then in `.env`:
```
CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

---

## Project structure

```
webcraft/
├── src/
│   ├── index.js              Entry point + graceful shutdown
│   ├── config.js             Centralised config + validation
│   ├── logger.js             Structured logger (timestamps + levels)
│   ├── minecraft-server.js   flying-squid wrapper (loopback only)
│   ├── ws-bridge.js          WebSocket ↔ TCP bridge + healthcheck
│   ├── admin.js              Internal HTTP admin API
│   ├── plugins.js            Plugin loader
│   └── world-persistence.js  Auto-save world to disk
├── proxy/
│   └── index.js              webcraft-proxy (run by players)
├── plugins/
│   ├── hello.js              Example: welcome message
│   └── motd-rotator.js       Example: rotating MOTD
├── scripts/
│   └── install.sh            One-line installer
├── .env.example
└── README.md
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © 2026 — [Kofysh](https://github.com/Kofysh)