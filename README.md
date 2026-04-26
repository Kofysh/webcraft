# 🧱 WebCraft

> A Minecraft server that runs on **any machine with Node.js** — no VPS, no Docker, no cloud platform required.

## How does it work?

Minecraft normally requires raw TCP on port 25565.  
WebCraft wraps the server behind a **WebSocket bridge** so it can run anywhere Node.js is available — including machines that only expose HTTP/HTTPS ports.

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
cp .env.example .env
node src/index.js
```

---

## Plugin pack included

WebCraft now ships with a lightweight plugin pack inspired by **EssentialsX** and **LuckPerms**.

### EssentialsX Lite

- `/spawn`
- `/sethome`, `/home`
- `/msg`, `/r`
- `/broadcast`
- `/kick`
- `/heal`, `/feed`
- `/fly`
- `/tp`, `/tphere`
- `/setwarp`, `/warp`, `/warps`
- `/mute`, `/unmute`
- `/help`

### LuckPerms Lite

- Groups: `admin`, `moderator`, `default`
- `/lp user <name> parent set <group>`
- `/lp group <group> permission set <perm>`
- `/whoami`
- Wildcards supported: `*`, `essentials.*`, etc.

Plugin docs live in [`plugins/README.md`](plugins/README.md).

---

## Players connect

Each player runs once on their own machine:

```bash
npx webcraft-proxy wss://your-host.example.com:8080
```

Then adds `127.0.0.1` as a server in Minecraft.

---

## Configuration

All settings live in `.env` (see `.env.example`).

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `8080` | Public WebSocket port |
| `CERT_PATH` | — | Path to TLS certificate (enables WSS) |
| `KEY_PATH` | — | Path to TLS private key |
| `MC_PORT` | `25565` | Internal Minecraft port (loopback only) |
| `MC_VERSION` | `1.20.4` | Minecraft version |
| `ONLINE_MODE` | `true` | Require Mojang auth |
| `MAX_PLAYERS` | `20` | Slot limit |
| `VIEW_DISTANCE` | `8` | Render distance |
| `MOTD` | see `.env.example` | Server list message |
| `RATE_LIMIT_MAX` | `10` | Max WS connections/IP/min |
| `ADMIN_PORT` | `9090` | Internal admin API port |
| `ADMIN_TOKEN` | — | Bearer token for admin API |
| `WORLD_DIR` | `./world` | World save directory |
| `AUTOSAVE_MIN` | `5` | Auto-save interval |
| `PLUGINS_DIR` | `./plugins` | Plugins directory |
| `LOG_LEVEL` | `INFO` | Log verbosity |

---

## Admin API

Listens on `127.0.0.1:ADMIN_PORT` only.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/status` | Server status + player list |
| GET | `/admin/players` | Online players |
| POST | `/admin/kick/:username` | Kick a player |
| POST | `/admin/broadcast` | Broadcast a message |

---

## License

MIT © 2026 — [Kofysh](https://github.com/Kofysh)
