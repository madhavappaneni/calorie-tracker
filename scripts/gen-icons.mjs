// Generates the PWA icons as PNGs with no image dependencies:
// a progress ring (the app's one visual idea) on the app background colour.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0x0f, 0x11, 0x15];
const TRACK = [0x25, 0x2a, 0x33];
const ACCENT = [0x3d, 0xdc, 0x84];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const png = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// Anti-aliased by 3x3 supersampling; alpha only ever comes from the rounded corners.
function render(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const inset = maskable ? size * 0.18 : 0; // maskable safe zone
  const radius = maskable ? 0 : size * 0.22;
  const ringR = (size - inset * 2) * 0.29;
  const ringW = (size - inset * 2) * 0.115;
  const SS = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          // rounded-rect coverage
          const dx = Math.max(radius - px, px - (size - radius), 0);
          const dy = Math.max(radius - py, py - (size - radius), 0);
          if (radius > 0 && Math.hypot(dx, dy) > radius) continue;
          const d = Math.hypot(px - c, py - c);
          let col = BG;
          if (Math.abs(d - ringR) <= ringW / 2) {
            // arc from 12 o'clock, clockwise, 78% complete
            let ang = Math.atan2(px - c, c - py); // 0 at top, +clockwise
            if (ang < 0) ang += Math.PI * 2;
            col = ang <= Math.PI * 2 * 0.78 ? ACCENT : TRACK;
          }
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = Math.round(a / n);
    }
  }
  return png(size, size, buf);
}

const out = [
  ['public/icon-192.png', render(192)],
  ['public/icon-512.png', render(512)],
  ['public/icon-maskable-512.png', render(512, { maskable: true })],
  ['public/apple-touch-icon.png', render(180)],
];
for (const [path, data] of out) {
  writeFileSync(path, data);
  console.log(`wrote ${path} (${data.length} bytes)`);
}
