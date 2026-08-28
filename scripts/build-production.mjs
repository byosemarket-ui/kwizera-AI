#!/usr/bin/env node
/**
 * Deterministic production build for KWIZERA AI STUDIO.
 *
 * Always emits:
 *   1. Server JS under dist/ (gateway + Core worker)
 *   2. Professional studio UI at dev/ui/desktop/index.html (Vite)
 *
 * Pass --server-only to skip the studio UI (local debugging only).
 * VPS deploy scripts must never pass --server-only.
 * Does not delete KWIZERA_STORAGE_ROOT. Does not install an external LLM.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const serverOnly = process.argv.includes("--server-only");
const desktopIndex = path.join(root, "dev", "ui", "desktop", "index.html");

function collectTsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      collectTsFiles(full, acc);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function resolveEsbuild() {
  try {
    return require.resolve("esbuild");
  } catch {
    try {
      return require.resolve("esbuild", { paths: [path.join(root, "node_modules", "vite")] });
    } catch {
      return null;
    }
  }
}

function resolveViteBin() {
  const candidates = [
    path.join(root, "node_modules", "vite", "bin", "vite.js"),
    path.join(root, "node_modules", "vite", "bin", "vite.mjs"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    return require.resolve("vite/bin/vite.js");
  } catch {
    return null;
  }
}

const esbuildPath = resolveEsbuild();
if (!esbuildPath) {
  console.error("[KWIZERA] esbuild is required for production transpile. Run npm install.");
  process.exit(1);
}

const { build } = await import(pathToFileURL(esbuildPath).href);

const sources = ["ai", "storage", "config", "dev"].flatMap((dir) =>
  collectTsFiles(path.join(root, dir)),
);

if (sources.length === 0) {
  console.error("[KWIZERA] No TypeScript sources found to compile.");
  process.exit(1);
}

const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });

console.log(`[KWIZERA] Transpiling ${sources.length} TypeScript files to dist/ …`);

await build({
  absWorkingDir: root,
  entryPoints: sources,
  outdir: dist,
  outbase: root,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  sourcesContent: false,
  logLevel: "warning",
  outExtension: { ".js": ".js" },
});

const gateway = path.join(dist, "dev", "server", "production-gateway.js");
const entry = path.join(dist, "dev", "server", "index.js");
if (!fs.existsSync(entry) || !fs.existsSync(gateway)) {
  console.error("[KWIZERA] Production entry was not emitted:", !fs.existsSync(gateway) ? gateway : entry);
  process.exit(1);
}

console.log("[KWIZERA] Production JS emit complete:", path.relative(root, gateway));
console.log("[KWIZERA] App worker:", path.relative(root, entry));

if (serverOnly) {
  console.warn("[KWIZERA] --server-only: studio UI was not built. VPS deploys must not use this flag.");
  console.log("[KWIZERA] Next: npm run start:production");
  process.exit(0);
}

const viteBin = resolveViteBin();
if (!viteBin) {
  console.error("[KWIZERA] vite is required to build the studio UI at", path.relative(root, desktopIndex));
  console.error("[KWIZERA] Install dependencies with: npm ci --include=dev");
  console.error("[KWIZERA] NODE_ENV=production npm ci omits vite when it lives in devDependencies.");
  process.exit(1);
}

console.log("[KWIZERA] Building professional studio UI (Vite → dev/ui/desktop) …");
const vite = spawnSync(process.execPath, [viteBin, "build", "--config", "desktop.vite.config.ts"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
});
if (vite.status !== 0) {
  console.error("[KWIZERA] Vite desktop build failed.");
  process.exit(vite.status ?? 1);
}

if (!fs.existsSync(desktopIndex)) {
  console.error("[KWIZERA] Studio UI missing after Vite build:", desktopIndex);
  console.error("[KWIZERA] Expected file: /opt/kwizera-ai/dev/ui/desktop/index.html");
  process.exit(1);
}

const html = fs.readFileSync(desktopIndex, "utf8");
if (/Dev Dashboard/i.test(html)) {
  console.error("[KWIZERA] Studio index looks like the legacy Dev Dashboard:", desktopIndex);
  process.exit(1);
}

console.log("[KWIZERA] Studio UI:", path.relative(root, desktopIndex));
console.log("[KWIZERA] Next: npm run start:production");
