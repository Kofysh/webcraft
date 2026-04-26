# Changelog

All notable changes to WebCraft are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `plugins/anti-spam.js` — chat flood + duplicate message protection with auto-mute
- `SECURITY.md` — responsible disclosure policy
- `CHANGELOG.md` — this file
- Unit tests for `config`, `logger`, `plugins`, `ban-manager`
- Fixed plugin load order (numeric prefix + core-api skip)
- Fixed `world-persistence.js` chunk serialisation crash
- Fixed `chat-formatter.js` double-dispatch with `setImmediate`
- `.gitignore` hardened: `data/`, `coverage/`, `world/`

---

## [0.1.0] — 2026-04-26

### Added
- Initial WebCraft architecture: flying-squid + WebSocket bridge
- `src/config.js` — centralised config with validation
- `src/logger.js` — structured logger
- `src/plugins.js` — plugin loader
- `src/ws-bridge.js` — WS/WSS bridge + healthcheck + rate limiting
- `src/admin.js` — internal HTTP admin API
- `src/world-persistence.js` — auto-save world to disk
- Graceful shutdown (SIGTERM/SIGINT/uncaughtException)
- TLS/WSS support via `CERT_PATH` + `KEY_PATH`
- `plugins/luckperms-lite.js` — groups + permissions
- `plugins/essentialsx-lite.js` — core utility commands
- `plugins/ban-manager.js` — ban/unban/tempban
- `plugins/gamemode.js` — gamemode commands
- `plugins/vanish.js` — staff vanish
- `plugins/nick.js` — player nicknames
- `plugins/staffchat.js` — staff chat channel
- `plugins/sudo.js` — force player actions
- `plugins/chat-formatter.js` — group prefix + nick in chat
- `plugins/invsee.js` — inventory inspection
- `scripts/install.sh` — one-line installer
- `proxy/` — local TCP→WS proxy for players
- GitHub Actions CI (Node 18/20/22 + npm audit)
- Issue templates (bug, feature, question)
