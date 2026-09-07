#!/usr/bin/env node
/**
 * Pre-boot quarantine for truncated/corrupt JSON stores.
 * Does NOT delete project media, audio, or video assets.
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
  "creative-pipeline-runtime/pipeline.json",
  "config/dev/session.json",
  "memory/storage/record-index.json",
  "knowledge/storage/knowledge-record-index.json",
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

function walkJson(dir, depth = 0) {
  if (depth > 5 || !fs.existsSync(dir)) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkJson(full, depth + 1);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    if (entry.name.includes(".corrupt.")) continue;
    // Skip project asset sidecars under creative-workspace/projects/*/images
    if (full.includes(`${path.sep}images${path.sep}`) || full.includes(`${path.sep}videos${path.sep}`)) {
      continue;
    }
    if (statSize(full) >= 100_000) {
      checkFile(full);
    }
  }
}

function statSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

console.log(`[KWIZERA] scanning storage for corrupt JSON under ${STORAGE_ROOT}`);
for (const relative of CANDIDATES) {
  checkFile(path.join(STORAGE_ROOT, relative));
}
// Also scan large JSON files that may have truncated mid-write.
walkJson(STORAGE_ROOT);
console.log("[KWIZERA] corrupt-json quarantine scan complete");
