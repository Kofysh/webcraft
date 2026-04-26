# WebCraft Plugin Pack

A full-featured plugin pack for WebCraft, inspired by **EssentialsX** and **LuckPerms**.

---

## Plugins

| Plugin | File | Description |
|--------|------|-------------|
| Core API | `core-api.js` | Shared helpers, command bus, persistence |
| LuckPerms Lite | `luckperms-lite.js` | Groups, permissions, wildcards |
| EssentialsX Lite | `essentialsx-lite.js` | Core player commands |
| Ban Manager | `ban-manager.js` | Ban, unban, tempban |
| Whitelist | `whitelist.js` | Join whitelist with runtime on/off |
| Gamemode | `gamemode.js` | /gm, /gmc, /gms, /gma, /gmsp |
| Vanish | `vanish.js` | Staff invisibility |
| Nick | `nick.js` | Display nicknames |
| Staff Chat | `staffchat.js` | Private staff channel |
| Sudo | `sudo.js` | Force player actions |
| Chat Formatter | `chat-formatter.js` | Group prefix + nick in chat |
| Anti-Spam | `anti-spam.js` | Rate limit + auto-mute |
| InvSee | `invsee.js` | Inspect player inventory |

---

## Command Reference

### LuckPerms Lite
```
/lp user <name> parent set <group>
/lp group <group> permission set <perm>
/whoami
```

### EssentialsX Lite
```
/spawn
/sethome   /home
/msg <player> <msg>   /r <msg>
/broadcast <msg>
/kick <player> [reason]
/heal [player]   /feed [player]
/fly [player]
/tp <player>   /tphere <player>
/setwarp <name>   /warp <name>   /warps
/mute <player>   /unmute <player>
/help
```

### Ban Manager
```
/ban <player> [reason]
/unban <player>
/tempban <player> <duration> [reason]   -- 30s, 10m, 2h, 7d
/banlist
/isbanned <player>
```

### Whitelist
```
/whitelist on
/whitelist off
/whitelist add <player>
/whitelist remove <player>
/whitelist list
/whitelist reload
```

### Gamemode
```
/gamemode <0|1|2|3|survival|creative|adventure|spectator> [player]
/gm <mode> [player]
/gms [player]   -- survival
/gmc [player]   -- creative
/gma [player]   -- adventure
/gmsp [player]  -- spectator
```

### Vanish
```
/vanish  (or /v)   -- toggle vanish
/vanishlist
```

### Nick
```
/nick <nickname>        -- set your nick
/nick off               -- remove your nick
/nick <player> <nick>   -- set someone else's (requires nick.others)
/realname <nick>        -- find real username behind a nick
```

### Staff Chat
```
/staffchat <msg>   (or /sc <msg>)
/togglesc          -- auto-redirect all chat to staff channel
```

### Sudo
```
/sudo <player> /command
/sudo <player> message
```

### InvSee
```
/invsee <player>
```

---

## Default Permission Groups

| Group | Permissions |
|-------|-------------|
| `admin` | `*` (everything) |
| `moderator` | ban, kick, mute, vanish, staffchat, sudo, invsee, tp, broadcast, heal, feed, fly, whitelist.admin |
| `default` | spawn, home, msg, warp, nick, help |

Assign a group:
```
/lp user Steve parent set moderator
```

---

## Data Files

All persistent data lives in `data/`:

| File | Contents |
|------|----------|
| `data/permissions.json` | Groups and user assignments |
| `data/essentials.json` | Homes, warps, muted players |
| `data/bans.json` | Ban entries (permanent + tempbans) |
| `data/nicks.json` | Player nicknames |
| `data/whitelist.json` | Whitelist state and player list |

---

## World Files

World data lives in `world/` in Anvil format:

```
world/
  region/
    r.0.0.mca       (chunks 0-31 x, 0-31 z)
    r.-1.0.mca
    ...
  level.json        (metadata snapshot)
```

The `.mca` files are compatible with standard Minecraft tools (MCEdit, Chunker, Amulet).

---

## Load Order

Plugins are loaded alphabetically by default. `core-api.js` is excluded from
auto-loading (it is a shared library, not a plugin). To guarantee a specific
order, prefix filenames with numbers:

```
plugins/
  01-luckperms-lite.js
  02-essentialsx-lite.js
  03-whitelist.js
  ...
```
