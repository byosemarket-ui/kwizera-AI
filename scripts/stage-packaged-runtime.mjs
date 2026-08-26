/**
 * Link or stage production runtime into packaged app-server so the installed EXE
 * can start the local API without first-run npm ci.
 *
 * Prefer a Windows directory junction (instant) when source+dest are on the same volume.
 * Fall back to recursive copy only when junction is unavailable.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unpacked = path.join(ROOT, "release", "win-unpacked");
const appServer = path.join(unpacked, "resources", "app-server");
const srcModules = path.join(ROOT, "node_modules");
const destModules = path.join(appServer, "node_modules");

if (!fs.existsSync(unpacked)) {
  console.error("Missing unpacked build:", unpacked);
  console.error("Run: npm run desktop:pack");
  process.exit(1);
}
if (!fs.existsSync(appServer)) {
  console.error("Missing app-server in package:", appServer);
  process.exit(1);
}
if (!fs.existsSync(srcModules)) {
  console.error("Missing repo node_modules. Run: npm ci");
  process.exit(1);
}

function hasTsx(dir) {
  return fs.existsSync(path.join(dir, "tsx", "dist", "cli.mjs"));
}

if (hasTsx(destModules)) {
  console.log("app-server/node_modules already ready (tsx present)");
  process.exit(0);
}

if (fs.existsSync(destModules)) {
  console.log("Removing incomplete node_modules…");
  try {
    fs.rmSync(destModules, { recursive: true, force: true });
  } catch {
    spawnSync("cmd", ["/c", "rmdir", "/s", "/q", destModules], { stdio: "ignore", shell: false });
  }
}

console.log("Linking node_modules into packaged app-server via junction…");
console.log("  from:", srcModules);
console.log("  to:", destModules);

const link = spawnSync("cmd", ["/c", "mklink", "/J", destModules, srcModules], {
  encoding: "utf8",
  shell: false,
});
if (link.status === 0 && hasTsx(destModules)) {
  console.log("Junction created successfully");
  process.exit(0);
}

console.log("Junction failed — falling back to copy (this may take several minutes)…");
console.log(link.stdout || link.stderr || "");
fs.cpSync(srcModules, destModules, { recursive: true });
if (!hasTsx(destModules)) {
  console.error("Staging failed — tsx still missing");
  process.exit(1);
}
console.log("Copy complete");
process.exit(0);
