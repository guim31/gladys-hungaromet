// -----------------------------------------------------------------------------
// Minimal ZIP reader: HungaroMet ships every file of its open data portal as a
// one-entry .zip. Reading it with node:zlib avoids a dependency (the sandbox
// has 256 MB and the image stays small). Stored (0) and deflated (8) entries
// only, which is all the portal produces.
// -----------------------------------------------------------------------------

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
// An uncompressed CSV of every station is ~120 kB: anything far larger is not
// what we expect, and must not fill the memory of the sandbox.
const MAX_SIZE = 20 * 1024 * 1024;

/**
 * The first file of a ZIP archive.
 * @param {Buffer} buffer the whole archive
 * @returns {{ name: string, data: Buffer }}
 */
export function unzipFirst(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new Error('not a ZIP archive (too short)');
  }
  // The end-of-central-directory record is in the last 22 + 65535 bytes.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('not a ZIP archive (no central directory)');
  }
  const entries = buffer.readUInt16LE(eocd + 10);
  const central = buffer.readUInt32LE(eocd + 16);
  if (
    entries < 1 ||
    central + 46 > buffer.length ||
    buffer.readUInt32LE(central) !== CENTRAL_SIGNATURE
  ) {
    throw new Error('empty or damaged ZIP archive');
  }
  const method = buffer.readUInt16LE(central + 10);
  const compressedSize = buffer.readUInt32LE(central + 20);
  const size = buffer.readUInt32LE(central + 24);
  const nameLength = buffer.readUInt16LE(central + 28);
  const local = buffer.readUInt32LE(central + 42);
  const name = buffer.toString('utf8', central + 46, central + 46 + nameLength);
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== LOCAL_SIGNATURE) {
    throw new Error('damaged ZIP archive (local header)');
  }
  if (size > MAX_SIZE) {
    throw new Error(`ZIP entry too large (${size} bytes)`);
  }
  const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
  const raw = buffer.subarray(start, start + compressedSize);
  if (raw.length !== compressedSize) {
    throw new Error('truncated ZIP archive');
  }
  if (method === 0) {
    return { name, data: Buffer.from(raw) };
  }
  if (method !== 8) {
    throw new Error(`unsupported ZIP compression method ${method}`);
  }
  return { name, data: inflateRawSync(raw, { maxOutputLength: MAX_SIZE }) };
}
