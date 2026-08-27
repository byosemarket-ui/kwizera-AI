#!/usr/bin/env node
/**
 * Deterministic production transpile for KWIZERA AI STUDIO.
 * Emits ESM JavaScript under dist/ without requiring a clean tsc typecheck.
 * Original KWIZERA modules are copied 1:1 (no bundling, no architecture rewrite).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

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

const entry = path.join(dist, "dev", "server", "index.js");
if (!fs.existsSync(entry)) {
  console.error("[KWIZERA] Production entry was not emitted:", entry);
  process.exit(1);
}

console.log("[KWIZERA] Production JS emit complete:", path.relative(root, entry));
console.log("[KWIZERA] Next: npm run start:production");
