/**
 * hello.js — Example WebCraft plugin
 * Sends a welcome message to each player when they join.
 *
 * Install: place this file in the plugins/ directory.
 * It will be loaded automatically at server startup.
 */

module.exports = function helloPlugin(server, config) {
  server.on('login', (client) => {
    // Small delay to ensure the client is fully initialised before receiving chat
    setTimeout(() => {
      client.write('chat', {
        message: JSON.stringify({
          text: `§aWelcome to the server, §e${client.username}§a! §7Type /help for help.`,
        }),
        position: 1,  // action bar
        sender: '00000000-0000-0000-0000-000000000000',
      });
    }, 1000);
  });
};
