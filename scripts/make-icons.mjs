// Generates the app icons and iOS splash screens as PNGs with no dependencies.
// Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

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
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const LAV = [212, 194, 255];
const PINK = [255, 199, 227];
const SKY = [191, 230, 255];
const INK = [29, 21, 48];
const BLACK = [8, 8, 10];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const grad = (t) => (t < 0.52 ? mix(LAV, PINK, t / 0.52) : mix(PINK, SKY, (t - 0.52) / 0.48));

// 4-point sparkle: |x|^p + |y|^p <= 1 with p < 1 gives the concave star shape.
const inSparkle = (x, y, cx, cy, r) => Math.abs((x - cx) / r) ** 0.55 + Math.abs((y - cy) / r) ** 0.55 <= 1;

function sample(w, h, shade, ss = 3) {
  return (x, y) => {
    let acc = [0, 0, 0];
    for (let i = 0; i < ss; i++)
      for (let j = 0; j < ss; j++) {
        const c = shade(x + (i + 0.5) / ss, y + (j + 0.5) / ss);
        acc = acc.map((v, k) => v + c[k]);
      }
    return acc.map((v) => Math.round(v / (ss * ss)));
  };
}

function icon(size, scale = 1) {
  const s = size;
  return png(
    s,
    s,
    sample(s, s, (x, y) => {
      const t = (x + y) / (2 * s);
      const c = s / 2;
      if (inSparkle(x, y, c, c * 1.04, s * 0.3 * scale)) return INK;
      if (inSparkle(x, y, c + s * 0.22 * scale, c - s * 0.2 * scale, s * 0.085 * scale)) return INK;
      return grad(t);
    }),
  );
}

function splash(w, h) {
  const r = Math.min(w, h) * 0.13;
  return png(
    w,
    h,
    sample(
      w,
      h,
      (x, y) => {
        if (inSparkle(x, y, w / 2, h / 2, r)) return grad((x - w / 2 + r) / (2 * r));
        return BLACK;
      },
      2,
    ),
  );
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/apple-touch-icon.png', icon(180));
writeFileSync('public/icons/icon-192.png', icon(192));
writeFileSync('public/icons/icon-512.png', icon(512));
writeFileSync('public/icons/maskable-512.png', icon(512, 0.78));
// iPhone 12–16 (390×844 @3x) and Pro Max / Plus (430×932 @3x), plus 393×852 (iPhone 14/15/16 Pro).
for (const [w, h] of [
  [1170, 2532],
  [1179, 2556],
  [1290, 2796],
]) {
  writeFileSync(`public/icons/splash-${w}x${h}.png`, splash(w, h));
}
console.log('icons written to public/icons');
