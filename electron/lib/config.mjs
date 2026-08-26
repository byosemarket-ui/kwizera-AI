/**
 * Local desktop configuration + logging for Phase 7 Step 1.
 * User data stays under Electron userData / configured storage root — not Program Files.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const AppLifecycle = {
  START: "START",
  READY: "READY",
  RUNNING: "RUNNING",
  SHUTTING_DOWN: "SHUTTING_DOWN",
  STOPPED: "STOPPED",
  FAILED: "FAILED",
};

/**
 * @param {string} userDataPath
 */
export function loadDesktopConfig(userDataPath) {
  const configPath = path.join(userDataPath, "desktop-config.json");
  const defaults = defaultConfig();
  defaults.__userDataPath = userDataPath;
  try {
    if (!fs.existsSync(configPath)) {
      saveDesktopConfig(defaults);
      return defaults;
    }
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const merged = {
      ...defaults,
      ...parsed,
      version: 1,
      host: parsed.host || defaults.host,
      port: Number(parsed.port) || defaults.port,
      storageRoot: parsed.storageRoot || defaults.storageRoot,
      featureFlags: { ...defaults.featureFlags, ...(parsed.featureFlags || {}) },
      __userDataPath: userDataPath,
    };
    // If a previously saved root is not writable (e.g. missing D: drive), fall back.
    try {
      fs.mkdirSync(merged.storageRoot, { recursive: true });
    } catch {
      merged.storageRoot = defaults.storageRoot;
      saveDesktopConfig(merged);
    }
    return merged;
  } catch {
    return defaults;
  }
}

/**
 * @param {any} config
 */
export function saveDesktopConfig(config) {
  const base = config.__userDataPath
    || path.join(os.homedir(), "AppData", "Roaming", "kwizera-ai-studio");
  const configPath = path.join(base, "desktop-config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    version: config.version ?? 1,
    host: config.host,
    port: config.port,
    storageRoot: config.storageRoot,
    environment: config.environment,
    lastWorkspace: config.lastWorkspace,
    windowBounds: config.windowBounds,
    featureFlags: config.featureFlags,
  }, null, 2), "utf8");
}

function defaultConfig() {
  const envRoot = process.env.KWIZERA_STORAGE_ROOT;
  let storageRoot = envRoot || "";
  if (!storageRoot && process.platform === "win32") {
    const preferred = "D:\\KWIZERA-AI-STUDIO";
    try {
      // Prefer existing project storage root when D: is present and writable.
      fs.mkdirSync(preferred, { recursive: true });
      storageRoot = preferred;
    } catch {
      storageRoot = path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "KWIZERA-AI-STUDIO",
      );
    }
  }
  if (!storageRoot) {
    storageRoot = path.join(os.homedir(), "KWIZERA-AI-STUDIO");
  }
  return {
    version: 1,
    host: "127.0.0.1",
    port: Number(process.env.KWIZERA_DEV_PORT ?? 5173),
    storageRoot,
    environment: "local-desktop",
    lastWorkspace: null,
    windowBounds: { width: 1440, height: 900 },
    featureFlags: {
      skipBrowserOpen: true,
      preferLocalServices: true,
      persistentRuntime: false,
    },
  };
}

/** @param {any} config */
export function ensureAppDirectories(config) {
  const root = config.storageRoot;
  const dirs = [
    root,
    path.join(root, "config"),
    path.join(root, "database"),
    path.join(root, "projects"),
    path.join(root, "uploads"),
    path.join(root, "exports"),
    path.join(root, "media"),
    path.join(root, "memory"),
    path.join(root, "knowledge"),
    path.join(root, "logs"),
    path.join(root, "cache"),
    path.join(root, "models"),
    path.join(root, "backups"),
    path.join(root, "temp"),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dirs;
}

/** @param {any} config */
export function getLogPath(config) {
  return path.join(config.storageRoot, "logs", "desktop-shell.log");
}

/** @param {any} config @param {string} message */
export function appendAppLog(config, message) {
  try {
    const logPath = getLogPath(config);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, line, "utf8");
  } catch {
    /* never throw from logger */
  }
}
