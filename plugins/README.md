# WebCraft plugin pack

This directory now includes a lightweight plugin pack inspired by **EssentialsX** and **LuckPerms**.

## Included plugins

- `core-api.js` — shared helpers for all plugins, command bus, chat helpers, JSON persistence
- `luckperms-lite.js` — groups + permissions, `/lp`, `/whoami`
- `essentialsx-lite.js` — core utility commands
- `hello.js` — welcome message example
- `motd-rotator.js` — rotating MOTD example

## Command examples

### Permissions

```txt
/lp user Steve parent set moderator
/lp group moderator permission set luckperms.manage
/whoami
```

### Essentials

```txt
/spawn
/sethome
/home
/msg Steve salut
/r yo
/broadcast restart dans 5 min
/kick Steve spam
/heal
/feed
/fly
/tp Steve
/tphere Alex
/setwarp shop
/warp shop
/warps
/mute Steve
/unmute Steve
/help
```

## Default groups

- `admin` → `*`
- `moderator` → staff commands
- `default` → player essentials (`/spawn`, `/home`, `/msg`, `/warp`, ...)

## Persistence

Plugin data is stored in:

- `data/permissions.json`
- `data/essentials.json`
