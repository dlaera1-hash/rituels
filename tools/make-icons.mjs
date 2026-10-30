// Génère les icônes PNG (un anneau aux trois quarts) sans dépendance.
// Usage : node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x7f, 0x77, 0xdd];
const TRACK = [0x9e, 0x98, 0xe6];
const RING = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const rows = [];
  const cx = size / 2;
  const r = size * 0.3;
  const w = size * 0.11;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cx;
      const d = Math.hypot(dx, dy);
      // Angle depuis midi, sens horaire, de 0 à 1
      const a = ((Math.atan2(dx, -dy) / (2 * Math.PI)) + 1) % 1;
      let col = BG;
      const edge = Math.abs(d - r);
      if (edge < w / 2) col = a < 0.72 ? RING : TRACK;
      // Bout arrondi de l'anneau
      const ends = [0, 0.72].map((t) => [cx + r * Math.sin(t * 2 * Math.PI), cx - r * Math.cos(t * 2 * Math.PI)]);
      for (const [ex, ey] of ends) if (Math.hypot(x + 0.5 - ex, y + 0.5 - ey) < w / 2) col = RING;
      row.set(col, 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../icons/', import.meta.url);
for (const s of [180, 192, 512]) writeFileSync(new URL(`icon-${s}.png`, out), png(s));
console.log('Icônes générées : 180, 192, 512');
