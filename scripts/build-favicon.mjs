// Shared Elma favicon assets for the landing page and workspace.
import sharp from "sharp";
import { readFile, writeFile, copyFile } from "node:fs/promises";
const source = "packages/brand/favicon.svg";
const output = "apps/landing/public";
const svg = await readFile(source);
await copyFile(source, `${output}/favicon.svg`);
// iOS applies its own corner mask, so the home-screen icon has an opaque background.
await sharp(Buffer.from(svg.toString().replace('rx="16"', 'rx="0"')))
  .resize(180, 180)
  .png()
  .toFile(`${output}/apple-touch-icon.png`);
await sharp(svg).resize(32, 32).png().toFile(`${output}/favicon-32x32.png`);
const sizes = [16, 32, 48];
const frames = await Promise.all(
  sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(`${output}/favicon.ico`, Buffer.concat([header, ...frames]));
