/**
 * Phase 4.7 — load operator secrets for local / Cursor verification runners.
 *
 * Priority (first non-empty wins for each key):
 * 1. Existing process.env
 * 2. Explicit KWIZERA_OPERATOR_ENV_FILE path
 * 3. %USERPROFILE%\.kwizera\operator.env (Windows) / $HOME/.kwizera/operator.env
 *
 * Never prints secret values. Safe to import from RO verify helpers.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SAFE_KEYS = new Set([
  "KWIZERA_ADMIN_API_TOKEN",
  "KWIZERA_PROD_BASE",
  "KWIZERA_OPERATOR_ENV_FILE",
]);

/**
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseDotEnvText(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!SAFE_KEYS.has(key) && !key.startsWith("KWIZERA_")) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * @returns {string[]}
 */
export function defaultOperatorEnvCandidates() {
  const home = os.homedir();
  const explicit = String(process.env.KWIZERA_OPERATOR_ENV_FILE ?? "").trim();
  const list = [];
  if (explicit) list.push(explicit);
  list.push(path.join(home, ".kwizera", "operator.env"));
  list.push(path.join(home, ".kwizera", "admin.env"));
  return list;
}

/**
 * @param {{ candidates?: string[], apply?: boolean }} [opts]
 * @returns {{ loadedFrom: string | null, keysApplied: string[], adminTokenPresent: boolean }}
 */
export function loadOperatorEnv(opts = {}) {
  const apply = opts.apply !== false;
  const candidates = opts.candidates ?? defaultOperatorEnvCandidates();
  /** @type {string[]} */
  const keysApplied = [];
  let loadedFrom = null;

  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    let text = "";
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const parsed = parseDotEnvText(text);
    loadedFrom = filePath;
    for (const [key, value] of Object.entries(parsed)) {
      const existing = process.env[key];
      if (existing != null && String(existing).trim() !== "") continue;
      if (apply) process.env[key] = value;
      keysApplied.push(key);
    }
    break;
  }

  const token = String(process.env.KWIZERA_ADMIN_API_TOKEN ?? "").trim();
  return {
    loadedFrom,
    keysApplied,
    adminTokenPresent: Boolean(token),
  };
}
