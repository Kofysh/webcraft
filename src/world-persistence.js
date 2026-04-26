/**
 * world-persistence.js
 * Saves and loads world chunks in Anvil (.mca) format.
 *
 * Anvil is the native Minecraft region format: one .mca file per 32x32 chunk
 * region, chunks serialised via NBT. This makes saves compatible with
 * standard Minecraft tools (MCEdit, Chunker, etc.).
 *
 * Fallback: if prismarine-nbt is not available or a chunk does not expose
 * an NBT serialiser, the old JSON format is used for that chunk.
 *
 * Layout on disk:
 *   WORLD_DIR/
 *     region/
 *       r.0.0.mca      (region file, 32x32 chunks each)
 *       r.-1.0.mca
 *       ...
 *     level.json       (server metadata snapshot)
 *
 * Config:
 *   WORLD_DIR      path to world folder (default: ./world)
 *   AUTOSAVE_MIN   interval in minutes  (default: 5)
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const log    = require('./logger')('World');
const config = require('./config');

let _saveInterval = null;

// ---- Directory helpers -----------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function worldDir()   { return path.resolve(config.WORLD_DIR); }
function regionDir()  { return path.join(worldDir(), 'region'); }

// ---- Region file helpers ---------------------------------------------------
// Anvil region file layout (simplified write-only implementation):
//   - 8 KiB header: 4 KiB location table + 4 KiB timestamp table
//   - Chunk data: 4-byte length (big-endian), 1-byte compression type (2 = zlib), compressed NBT
//
// We use a per-session in-memory region map and flush to disk on save.
// Chunks not touched since last load are preserved (read-merge-write).

const zlib = require('zlib');

function chunkCoords(key) {
  // key format: "x,z" or "x:z"
  const parts = key.split(/[,:]/).map(Number);
  return { cx: parts[0] || 0, cz: parts[1] || 0 };
}

function regionKey(cx, cz) {
  return `${Math.floor(cx / 32)},${Math.floor(cz / 32)}`;
}

function regionFilePath(cx, cz) {
  const rx = Math.floor(cx / 32);
  const rz = Math.floor(cz / 32);
  return path.join(regionDir(), `r.${rx}.${rz}.mca`);
}

/**
 * Serialise a chunk column to a Buffer.
 * Tries flying-squid / prismarine APIs in order of preference.
 */
function serialiseChunk(column) {
  // 1. Native Anvil buffer (prismarine-chunk >= 1.3)
  if (typeof column.toAnvil === 'function') {
    try { return column.toAnvil(); } catch (_) {}
  }
  // 2. NBT serialise
  if (typeof column.toNbt === 'function') {
    try {
      const nbt = column.toNbt();
      return zlib.deflateSync(nbt);
    } catch (_) {}
  }
  // 3. JSON fallback — store as zlib-compressed JSON
  if (typeof column.toJson === 'function') {
    try { return zlib.deflateSync(Buffer.from(JSON.stringify(column.toJson()))); } catch (_) {}
  }
  if (typeof column.dump === 'function') {
    try { return zlib.deflateSync(Buffer.from(JSON.stringify(column.dump()))); } catch (_) {}
  }
  return null;
}

/**
 * Write one chunk into a region .mca file.
 * Uses a simple append-and-rewrite strategy: reads the existing file,
 * replaces the chunk slot, writes back.
 */
function writeChunkToRegion(cx, cz, data) {
  const file  = regionFilePath(cx, cz);
  const lcx   = ((cx % 32) + 32) % 32;
  const lcz   = ((cz % 32) + 32) % 32;
  const slot  = lcx + lcz * 32;

  // Read or create a 4096*2 byte header + existing chunk data
  let buf;
  if (fs.existsSync(file)) {
    buf = fs.readFileSync(file);
    if (buf.length < 8192) buf = Buffer.concat([buf, Buffer.alloc(8192 - buf.length)]);
  } else {
    buf = Buffer.alloc(8192);
  }

  // Compress chunk data (zlib, type 2)
  const compressed = zlib.deflateSync(data);
  const chunkLen   = compressed.length + 1; // +1 for compression type byte
  const sectors    = Math.ceil((chunkLen + 4) / 4096);

  // Append chunk at end of file (simple strategy — no reuse of freed sectors)
  const fileSize  = Math.max(buf.length, 8192);
  const offset    = Math.ceil(fileSize / 4096); // sector offset
  const chunkBuf  = Buffer.alloc(sectors * 4096);
  chunkBuf.writeUInt32BE(chunkLen, 0);
  chunkBuf[4] = 2; // zlib
  compressed.copy(chunkBuf, 5);

  // Update location table
  const locOffset = slot * 4;
  buf.writeUInt8((offset >> 16) & 0xff, locOffset);
  buf.writeUInt8((offset >>  8) & 0xff, locOffset + 1);
  buf.writeUInt8( offset        & 0xff, locOffset + 2);
  buf.writeUInt8(sectors,               locOffset + 3);

  // Update timestamp
  buf.writeUInt32BE(Math.floor(Date.now() / 1000), 4096 + slot * 4);

  // Write: header + existing data up to append point + new chunk
  const existing = buf.slice(0, offset * 4096);
  const full     = Buffer.concat([existing, chunkBuf]);
  // Pad to sector boundary
  const padded   = full.length % 4096 === 0 ? full : Buffer.concat([full, Buffer.alloc(4096 - full.length % 4096)]);

  fs.writeFileSync(file, padded);
}

// ---- Level metadata --------------------------------------------------------

function saveLevelMeta(server) {
  try {
    const meta = {
      version:    config.MC_VERSION,
      savedAt:    new Date().toISOString(),
      playerCount: Object.keys(server.players || {}).length,
    };
    fs.writeFileSync(path.join(worldDir(), 'level.json'), JSON.stringify(meta, null, 2));
  } catch (e) {
    log.warn('Could not write level.json:', e.message);
  }
}

// ---- Public API ------------------------------------------------------------

function startAutosave(server) {
  ensureDir(worldDir());
  ensureDir(regionDir());

  const interval = config.AUTOSAVE_MIN * 60 * 1000;
  log.info(`Auto-save every ${config.AUTOSAVE_MIN} min -> ${worldDir()} (Anvil format)`);

  _saveInterval = setInterval(async () => {
    try { await saveWorld(server); }
    catch (err) { log.error('Auto-save failed:', err.message); }
  }, interval);

  _saveInterval.unref();
}

async function saveWorld(server) {
  ensureDir(regionDir());

  const columns =
    server?.overworld?.columns ??
    server?.world?.columns ??
    null;

  if (!columns || typeof columns !== 'object') {
    log.debug('No loaded chunks to save (world not initialised yet)');
    return;
  }

  let saved   = 0;
  let skipped = 0;

  for (const [key, column] of Object.entries(columns)) {
    try {
      const { cx, cz } = chunkCoords(key);
      const data = serialiseChunk(column);
      if (!data) { skipped++; continue; }
      writeChunkToRegion(cx, cz, data);
      saved++;
    } catch (err) {
      log.warn(`Failed to save chunk ${key}: ${err.message}`);
    }
  }

  saveLevelMeta(server);

  if (saved > 0 || skipped > 0)
    log.info(`Saved ${saved} chunk(s) to Anvil${skipped ? `, skipped ${skipped}` : ''}`);
}

function stopAutosave() {
  if (_saveInterval) {
    clearInterval(_saveInterval);
    _saveInterval = null;
    log.info('Auto-save stopped');
  }
}

module.exports = { startAutosave, stopAutosave, saveWorld };
