#!/usr/bin/env node
/**
 * Cross-platform production starter for KWIZERA AI STUDIO.
 * Requires a prior `npm run build:production`.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "dist", "dev", "server", "production-gateway.js");
const studioIndex = path.join(root, "dev", "ui", "desktop", "index.html");

if (!fs.existsSync(entry)) {
  console.error("[KWIZERA] Production build missing.");
  console.error("  Run: npm run build:production");
  process.exit(1);
}
if (!fs.existsSync(studioIndex)) {
  console.error("[KWIZERA] Studio UI missing:", studioIndex);
  console.error("  Run: npm run build:production");
  process.exit(1);
}

process.env.NODE_ENV ??= "production";
process.env.KWIZERA_ENV ??= "production";
process.env.KWIZERA_SKIP_BROWSER_OPEN ??= "1";
process.env.KWIZERA_PERSISTENT_MODE ??= "1";
process.env.KWIZERA_PROJECT_ROOT ??= root;

const child = spawn(process.execPath, [entry], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

const shutdown = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
