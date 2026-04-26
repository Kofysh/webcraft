# Changelog

All notable changes to WebCraft are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Fixed
- Plugin load order: numeric prefix sort + automatic skip of `core-api.js`
- `world-persistence.js`: defensive chunk serialisation (tries `.toJson()` then `.dump()`)
- `chat-formatter.js`: double-dispatch resolved via `setImmediate`
- `admin.js`: harden auth - blocks all requests when `ONLINE_MODE=true` and no `ADMIN_TOKEN` is set
- `ws-bridge.js`: removed emoji from log lines for clean stdout
- `src/index.js`: removed emoji from log lines

### Added
- `plugins/anti-spam.js`: chat flood + duplicate message filter + auto-mute
- `SECURITY.md`: responsible disclosure policy
- `CHANGELOG.md`: this file
- `Dockerfile` + `docker-compose.yml`: containerised deployment
- `.dockerignore`: optimised Docker build context
- `package.json`: Jest config inline, `test:watch`, `test:coverage`, `lint` scripts
- `.github/pull_request_template.md`: checklist for contributors
- CI: syntax check step + coverage artifact upload
- Unit tests: `config`, `logger`, `plugins`, `ban-manager`

---

## [0.1.0] - 2026-04-26

### Added
- Initial WebCraft architecture: flying-squid + WebSocket bridge
- `src/config.js`: centralised config with validation
- `src/logger.js`: structured logger
- `src/plugins.js`: plugin loader
- `src/ws-bridge.js`: WS/WSS bridge + healthcheck + rate limiting
- `src/admin.js`: internal HTTP admin API
- `src/world-persistence.js`: auto-save world to disk
- Graceful shutdown on SIGTERM/SIGINT/uncaughtException
- TLS/WSS support via `CERT_PATH` + `KEY_PATH`
- Full plugin pack: LuckPerms Lite, EssentialsX Lite, Ban Manager, Gamemode,
  Vanish, Nick, Staff Chat, Sudo, Chat Formatter, InvSee
- `scripts/install.sh`: one-line installer
- `proxy/`: local TCP->WS proxy for players
- GitHub Actions CI (Node 18/20/22 + npm audit)
- Issue templates (bug, feature, question)
