// Generates app icons (pixel-art dumbbell on dark navy) with zero dependencies.
// Writes public/icons/icon-{64,180,192,512}.png and icon-maskable-512.png
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

// 16x16 pixel-art design grid. Legend: . bg, # dumbbell plate (cyan), = bar, g glow, u underline
const ART = [
  '................',
  '................',
  '................',
  '...##......##...',
  '...##......##...',
  '..####....####..',
  '..####....####..',
  '..####====####..',
  '..####====####..',
  '..####....####..',
  '..####....####..',
  '...##......##...',
  '...##......##...',
  '................',
  '..uuuuuuuuuuuu..',
  '................',
];

const COLORS = {
  bg: hex('#070b16'),
  plate: hex('#3fd8f2'),
  bar: hex('#b7a6ff'),
  under: hex('#1d3a5f'),
};

function drawIcon(size, { pad = 0 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const [br, bg_, bb] = COLORS.bg;
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = br;
    rgba[i * 4 + 1] = bg_;
    rgba[i * 4 + 2] = bb;
    rgba[i * 4 + 3] = 255;
  }
  // subtle horizontal scanlines
  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      rgba[i] = Math.min(255, rgba[i] + 5);
      rgba[i + 1] = Math.min(255, rgba[i + 1] + 6);
      rgba[i + 2] = Math.min(255, rgba[i + 2] + 9);
    }
  }
  const grid = 16;
  const inner = size - pad * 2;
  const cell = Math.floor(inner / grid);
  const off = pad + Math.floor((inner - cell * grid) / 2);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const ch = ART[gy][gx];
      let col = null;
      if (ch === '#') col = COLORS.plate;
      else if (ch === '=') col = COLORS.bar;
      else if (ch === 'u') col = COLORS.under;
      if (!col) continue;
      for (let y = gy * cell; y < (gy + 1) * cell; y++) {
        for (let x = gx * cell; x < (gx + 1) * cell; x++) {
          const i = ((off + y) * size + (off + x)) * 4;
          rgba[i] = col[0];
          rgba[i + 1] = col[1];
          rgba[i + 2] = col[2];
          rgba[i + 3] = 255;
        }
      }
    }
  }
  return encodePNG(size, size, rgba);
}

for (const size of [64, 180, 192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), drawIcon(size));
}
// maskable: extra padding so the safe zone survives circular masks
writeFileSync(join(outDir, 'icon-maskable-512.png'), drawIcon(512, { pad: 88 }));
console.log('icons written to public/icons');
