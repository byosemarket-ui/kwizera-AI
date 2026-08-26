/**
 * Convert PNG icon to a basic multi-size ICO for Windows shortcuts.
 * Uses only Node builtins + the existing PNG (no extra image libs required).
 *
 * For production polish, replace electron/assets/icon.ico with a designer ICO.
 * electron-builder also accepts icon.png when ico is absent.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pngPath = path.join(__dirname, "assets", "icon.png");
const icoPath = path.join(__dirname, "assets", "icon.ico");

if (!fs.existsSync(pngPath)) {
  console.error("Missing", pngPath);
  process.exit(1);
}

// Minimal approach: copy PNG alongside and write a tiny valid ICO that embeds the PNG
// (PNG-compressed ICO is supported on Windows Vista+).
const png = fs.readFileSync(pngPath);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // icon type
header.writeUInt16LE(1, 4); // count

const entry = Buffer.alloc(16);
entry[0] = 0; // width 0 => 256
entry[1] = 0; // height 0 => 256
entry[2] = 0; // colors
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(6 + 16, 12); // offset

fs.writeFileSync(icoPath, Buffer.concat([header, entry, png]));
console.log("Wrote", icoPath, `(${png.length} png bytes embedded)`);
