import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, "..", "public", "icons");
fs.mkdirSync(output, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const label = Buffer.from(name);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, checksum]);
}

function makePng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 192;
  const cx = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const dx = (x - cx) / scale;
      const dy = (y - cx) / scale;
      const rounded = Math.hypot(Math.max(Math.abs(dx) - 76, 0), Math.max(Math.abs(dy) - 76, 0)) <= 40;
      if (!rounded) continue;
      pixels[index] = 82; pixels[index + 1] = 116; pixels[index + 2] = 91; pixels[index + 3] = 255;
      const bar = [-18, 0, 18].some((center, n) => Math.abs(dx - center) < 4.5 && Math.abs(dy) < [12, 22, 16][n]);
      const circle = Math.hypot(dx, dy) < 39 && Math.hypot(dx, dy) > 35;
      if (bar || circle) { pixels[index] = 255; pixels[index + 1] = 255; pixels[index + 2] = 255; }
    }
  }
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(output, `patungan-${size}.png`), makePng(size));
}
