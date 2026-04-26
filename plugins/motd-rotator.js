/**
 * motd-rotator.js — Example WebCraft plugin
 * Rotates the server MOTD (shown in the Minecraft server list) every 30 seconds.
 *
 * Install: place this file in the plugins/ directory.
 */

const MOTDS = [
  '§aWebCraft §7— Minecraft on the web ✨',
  '§bOpen source §7— github.com/Kofysh/webcraft',
  '§dJoin and build something awesome!',
  '§6WebCraft §7— zero VPS, pure Node.js',
];

module.exports = function motdRotatorPlugin(server) {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % MOTDS.length;
    server.motd = MOTDS[i];
  }, 30_000);
};
