#!/usr/bin/env node
/**
 * Pre-boot quarantine for truncated/corrupt JSON stores.
 * Does NOT delete project media, audio, or video assets.
 * Keep this FAST — only known high-risk store paths (no full tree walk).
 */
import fs from "node:fs";
import path from "node:path";

const STORAGE_ROOT = process.env.KWIZERA_STORAGE_ROOT || "/var/lib/kwizera-ai-studio";
const MAX_SCAN_BYTES = Number(process.env.KWIZERA_JSON_QUARANTINE_MAX_BYTES || 32 * 1024 * 1024);

const CANDIDATES = [
  "learning-intelligence-runtime/learning.json",
  "image-intelligence-runtime/profiles.json",
  "product-intelligence-runtime/profiles.json",
  "marketing-intelligence-runtime/profiles.json",
  "decision-intelligence-runtime/profiles.json",
  "creative-pipeline-runtime/pipeline.json",
  "creative-workspace/workspace-session.json",
  "config/dev/session.json",
  "memory/storage/record-index.json",
  "knowledge/storage/knowledge-record-index.json",
  "memory-foundation/storage/record-index.json",
  "knowledge-foundation/storage/knowledge-record-index.json",
];

function quarantine(filePath, reason) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${filePath}.corrupt.${stamp}`;
  fs.renameSync(filePath, dest);
  console.warn(`[KWIZERA] quarantined ${filePath} → ${dest} (${reason})`);
  return dest;
}

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return;
  if (stat.size > MAX_SCAN_BYTES) {
    quarantine(filePath, `oversized ${stat.size} bytes`);
    return;
  }
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    quarantine(filePath, error instanceof Error ? error.message : String(error));
    return;
  }
  if (!raw.trim()) return;
  try {
    JSON.parse(raw);
  } catch (error) {
    quarantine(filePath, error instanceof Error ? error.message : String(error));
  }
}

/** Find oversized/corrupt JSON under a few known runtime dirs (bounded depth). */
function scanRuntimeDir(relativeDir, depthLimit = 2) {
  const root = path.join(STORAGE_ROOT, relativeDir);
  if (!fs.existsSync(root)) return;

  function walk(dir, depth) {
    if (depth > depthLimit) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.includes("corrupt") || entry.name === "images" || entry.name === "videos" || entry.name === "audio-library") {
          continue;
        }
        walk(full, depth + 1);
        continue;
      }
      if (!entry.name.endsWith(".json") || entry.name.includes(".corrupt.")) continue;
      try {
        const size = fs.statSync(full).size;
        // Always validate large JSON; also validate known index/store names.
        if (
          size >= 256 * 1024
          || /^(learning|profiles|pipeline|session|record-index|knowledge-record-index|workspace-session)\.json$/i.test(entry.name)
          || entry.name === "current.json"
        ) {
          checkFile(full);
        }
      } catch {
        /* ignore */
      }
    }
  }

  walk(root, 0);
}

console.log(`[KWIZERA] scanning storage for corrupt JSON under ${STORAGE_ROOT}`);
for (const relative of CANDIDATES) {
  checkFile(path.join(STORAGE_ROOT, relative));
}
for (const dir of [
  "learning-intelligence-runtime",
  "image-intelligence-runtime",
  "product-intelligence-runtime",
  "marketing-intelligence-runtime",
  "creative-pipeline-runtime",
  "creative-workspace",
  "config",
  "memory",
  "knowledge",
  "memory-foundation",
  "knowledge-foundation",
]) {
  scanRuntimeDir(dir, dir === "memory" || dir === "knowledge" || dir.includes("foundation") ? 4 : 2);
}
console.log("[KWIZERA] corrupt-json quarantine scan complete");
