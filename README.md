# 🧱 WebCraft

![CI](https://github.com/Kofysh/webcraft/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

> A Minecraft server that runs on **any machine with Node.js** — no VPS, no Docker, no cloud platform required.

## How does it work?

Minecraft normally requires raw TCP on port 25565.  
WebCraft wraps the server behind a **WebSocket bridge** so it can run anywhere Node.js is available.

```
Player's PC                        Any Node.js host
────────────────────────────     ─────────────────────────────────
Minecraft Client                   ┌────────────────────────────┐
   └─► TCP :25565 (local)          │  WebCraft                  │
         │                         │                            │
webcraft-proxy    ──── WSS ────────►│  WS Bridge → flying-squid  │
(run once on PC)                   │  :8080     → :25565 (lo)   │
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
cp .env.example .env   # edit .env
node src/index.js
```

---

## Plugin pack

WebCraft ships with a full plugin pack:

| Plugin | Commands |
|--------|----------|
| LuckPerms Lite | `/lp`, `/whoami` |
| EssentialsX Lite | `/spawn`, `/home`, `/msg`, `/broadcast`, `/kick`, `/heal`, `/feed`, `/fly`, `/tp`, `/warp`, `/help` |
| Ban Manager | `/ban`, `/unban`, `/tempban`, `/banlist` |
| Gamemode | `/gmc`, `/gms`, `/gma`, `/gmsp` |
| Vanish | `/vanish`, `/vanishlist` |
| Nick | `/nick`, `/realname` |
| Staff Chat | `/sc`, `/togglesc` |
| Sudo | `/sudo` |
| Chat Formatter | Group prefix + nick in chat |
| Anti-Spam | Auto rate-limit + auto-mute |
| InvSee | `/invsee` |

See [`plugins/README.md`](plugins/README.md) for the full command reference.

---

## Configuration

All settings live in `.env` (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8080` | Public WebSocket port |
| `CERT_PATH` | — | TLS certificate path (enables WSS) |
| `KEY_PATH` | — | TLS private key path |
| `MC_PORT` | `25565` | Internal Minecraft port (loopback only) |
| `MC_VERSION` | `1.20.6` | Minecraft version |
| `ONLINE_MODE` | `true` | Require Mojang auth |
| `MAX_PLAYERS` | `20` | Slot limit |
| `VIEW_DISTANCE` | `8` | Render distance |
| `MOTD` | see `.env.example` | Server list message |
| `RATE_LIMIT_MAX` | `10` | Max WS connections/IP/min |
| `ADMIN_PORT` | `9090` | Internal admin API port |
| `ADMIN_TOKEN` | — | Bearer token for admin API |
| `WORLD_DIR` | `./world` | World save directory |
| `AUTOSAVE_MIN` | `5` | Auto-save interval (minutes) |
| `PLUGINS_DIR` | `./plugins` | Plugins directory |
| `LOG_LEVEL` | `INFO` | Log verbosity |
| `ANTISPAM_MSG_MAX` | `5` | Anti-spam: max messages per window |
| `ANTISPAM_WINDOW_MS` | `3000` | Anti-spam: window in ms |
| `ANTISPAM_MUTE_SECONDS` | `30` | Anti-spam: auto-mute duration |

---

## Admin API

Listens on `127.0.0.1:ADMIN_PORT` — never exposed publicly.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/status` | Server status + player list |
| GET | `/admin/players` | Online players |
| POST | `/admin/kick/:username` | Kick a player |
| POST | `/admin/broadcast` | Broadcast a message |

Secure with `ADMIN_TOKEN`: `Authorization: Bearer <token>`

---

## TLS / WSS

```bash
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
│   ├── config.js             Config + validation
│   ├── logger.js             Structured logger
│   ├── minecraft-server.js   flying-squid wrapper (loopback)
│   ├── ws-bridge.js          WS/WSS bridge + healthcheck
│   ├── admin.js              Internal HTTP admin API
│   ├── plugins.js            Plugin loader
│   └── world-persistence.js  Auto-save world
├── plugins/                  Plugin pack (EssentialsX, LuckPerms, ...)
├── tests/                    Jest unit tests
├── proxy/
│   └── index.js              Local TCP→WS proxy (run by players)
├── scripts/
│   └── install.sh            One-line installer
├── .env.example
├── CHANGELOG.md
├── SECURITY.md
└── README.md
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT © 2026 — [Kofysh](https://github.com/Kofysh)
