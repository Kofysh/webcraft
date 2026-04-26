# Changelog

All notable changes to WebCraft are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `plugins/whitelist.js`: runtime whitelist with on/off toggle, add/remove/list/reload commands
- `src/world-persistence.js`: Anvil (.mca) format world saves
  - One region file per 32x32 chunk area
  - Tries `toAnvil()`, then `toNbt()`, then JSON fallback per chunk
  - `level.json` metadata snapshot on each save
  - Compatible with MCEdit, Chunker, Amulet
- Admin dashboard: Whitelist panel (enable/disable, add/remove players)
- Admin API: `GET /admin/whitelist`, `POST /admin/whitelist/on|off|add|remove`
- `plugins/README.md`: whitelist commands, Anvil world layout, updated permission table

### Added (previous)
- Web admin dashboard with login, SSE logs, player table, ban manager, broadcast
- `plugins/anti-spam.js`, `SECURITY.md`, `Dockerfile`, `docker-compose.yml`
- Unit tests for config, logger, plugins, ban-manager
- Jest config, lint script, CI coverage upload

### Fixed
- Plugin load order, world-save crash, chat double-dispatch, admin auth hardening

---

## [0.1.0] - 2026-04-26

### Added
- Initial WebCraft architecture: flying-squid + WebSocket bridge
- Centralised config, structured logger, plugin loader
- WS/WSS bridge, healthcheck, rate limiting, graceful shutdown
- TLS/WSS support, full plugin pack, one-line installer, CI
