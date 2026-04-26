# Changelog

All notable changes to WebCraft are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Web admin dashboard served at `http://127.0.0.1:ADMIN_PORT/`
  - Login page with session cookie (8h session)
  - Server status: player count, max slots, uptime
  - Online player table: kick and quick-ban buttons
  - Ban manager: add ban, list bans, unban
  - Broadcast form
  - Live log stream via SSE (last 200 lines buffered)
- Admin API new endpoints: `GET /admin/bans`, `POST /admin/ban/:username`, `POST /admin/unban/:username`
- Session-based auth for the dashboard (form login) alongside existing Bearer token support

### Fixed
- Plugin load order: numeric prefix sort + automatic skip of `core-api.js`
- `world-persistence.js`: defensive chunk serialisation
- `chat-formatter.js`: double-dispatch resolved via `setImmediate`
- `admin.js`: blocks requests when `ONLINE_MODE=true` and no `ADMIN_TOKEN` set
- `ws-bridge.js` and `index.js`: removed emoji from log lines

### Added (previous)
- `plugins/anti-spam.js`, `SECURITY.md`, `CHANGELOG.md`
- `Dockerfile` + `docker-compose.yml`
- Unit tests for `config`, `logger`, `plugins`, `ban-manager`
- Jest config inline, `test:watch`, `test:coverage`, `lint` scripts
- CI: syntax check + coverage artifact upload

---

## [0.1.0] - 2026-04-26

### Added
- Initial WebCraft architecture: flying-squid + WebSocket bridge
- Centralised config, structured logger, plugin loader
- WS/WSS bridge + healthcheck + rate limiting
- Graceful shutdown on SIGTERM/SIGINT
- TLS/WSS support via `CERT_PATH` + `KEY_PATH`
- Full plugin pack: LuckPerms Lite, EssentialsX Lite, Ban Manager, Gamemode,
  Vanish, Nick, Staff Chat, Sudo, Chat Formatter, InvSee
- One-line installer, local TCP->WS proxy, GitHub Actions CI
