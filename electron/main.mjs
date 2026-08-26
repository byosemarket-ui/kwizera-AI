/**
 * KWIZERA AI STUDIO — Electron desktop shell (Phase 7 Step 1)
 * Wraps existing local API + Vite desktop UI. Does not duplicate backend.
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDesktopConfig,
  saveDesktopConfig,
  ensureAppDirectories,
  appendAppLog,
  getLogPath,
} from "./lib/config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPackaged = app.isPackaged;

/** @type {import("electron").BrowserWindow | null} */
let mainWindow = null;
/** @type {import("electron").BrowserWindow | null} */
let splashWindow = null;
/** @type {import("node:child_process").ChildProcess | null} */
let serverProcess = null;
let startedServerOurselves = false;
/** @type {string} */
let lifecycle = "START";
/** @type {ReturnType<typeof loadDesktopConfig>} */
let config;
let shuttingDown = false;

function projectRoot() {
  if (isPackaged) {
    return path.join(process.resourcesPath, "app-server");
  }
  return path.resolve(__dirname, "..");
}

function iconPath() {
  const ico = path.join(__dirname, "assets", "icon.ico");
  const png = path.join(__dirname, "assets", "icon.png");
  return fs.existsSync(ico) ? ico : png;
}

function workspaceUrl() {
  return `http://${config.host}:${config.port}/desktop/`;
}

function healthUrl() {
  return `http://${config.host}:${config.port}/api/health`;
}

function statusUrl() {
  return `http://${config.host}:${config.port}/api/desktop-workspace/status`;
}

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<{ ok: boolean; status: number; body: unknown }>}
 */
function httpGetJson(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      /** @type {Buffer[]} */
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body = /** @type {unknown} */ (raw);
        try {
          body = JSON.parse(raw);
        } catch {
          /* keep raw */
        }
        resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", () => resolve({ ok: false, status: 0, body: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: null });
    });
  });
}

/**
 * @param {string} url
 * @param {Record<string, unknown>} body
 * @param {number} [timeoutMs]
 * @returns {Promise<{ ok: boolean; status: number; body: unknown }>}
 */
function httpPostJson(url, body, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const payload = JSON.stringify(body ?? {});
    const u = new URL(url);
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (res) => {
        /** @type {Buffer[]} */
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed = /** @type {unknown} */ (raw);
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* keep */
          }
          resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on("error", () => resolve({ ok: false, status: 0, body: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: null });
    });
    req.write(payload);
    req.end();
  });
}

async function probeInternet() {
  const result = await httpGetJson("https://www.msftconnecttest.com/connecttest.txt", 3000);
  return result.ok || result.status > 0;
}

function detectHardware() {
  const cpus = os.cpus();
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpuModel: cpus[0]?.model ?? "UNKNOWN",
    cpuCores: cpus.length,
    ramTotalMb: Math.round(os.totalmem() / (1024 * 1024)),
    ramFreeMb: Math.round(os.freemem() / (1024 * 1024)),
    gpu: "Detection deferred to Phase 7 Step 4 Resource Monitor",
    vram: "NOT AVAILABLE",
  };
}

/**
 * @param {string} root
 */
function detectLocalAi(root) {
  const modelHints = [
    path.join(config.storageRoot, "models"),
    path.join(root, "models"),
    path.join(config.storageRoot, "cache", "models"),
  ];
  const existing = modelHints.filter((p) => fs.existsSync(p));
  return {
    modelsDirectory: existing[0] ?? modelHints[0],
    modelsPresent: existing.some((p) => {
      try {
        return fs.readdirSync(p).length > 0;
      } catch {
        return false;
      }
    }),
    note: existing.length
      ? "Model directory found — availability depends on installed model files."
      : "No local model directory detected yet (optional).",
  };
}

/**
 * @param {number} [maxAttempts]
 */
async function waitForHealth(maxAttempts = 300) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await httpGetJson(healthUrl(), 2500);
    if (
      result.ok
      && result.body
      && typeof result.body === "object"
      && /** @type {{ ok?: boolean }} */ (result.body).ok
    ) {
      return { ready: true, body: result.body };
    }
    await delay(1000);
  }
  return { ready: false, body: null, error: `Local API did not become ready at ${healthUrl()}` };
}

/**
 * @param {string} root
 */
function startLocalApi(root) {
  if (serverProcess) return;
  const env = {
    ...process.env,
    KWIZERA_DEV_PORT: String(config.port),
    KWIZERA_STORAGE_ROOT: config.storageRoot,
    KWIZERA_SKIP_BROWSER_OPEN: "1",
    KWIZERA_DESKTOP_SHELL: "1",
    // Prefer local-first desktop readiness. Persistent AI restore remains available via config flag.
    KWIZERA_PERSISTENT_MODE: config.featureFlags?.persistentRuntime === true ? "1" : "0",
  };

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const hasNodeModules = fs.existsSync(path.join(root, "node_modules"));
  if (isPackaged && !hasNodeModules) {
    appendAppLog(config, "Packaged first-run: installing dependencies for local API…");
    // shell:true required on Windows for .cmd shims (avoids spawn EINVAL)
    const install = spawn(npmCmd, ["ci"], {
      cwd: root,
      env,
      stdio: "ignore",
      windowsHide: true,
      shell: true,
    });
    serverProcess = install;
    install.on("exit", () => {
      serverProcess = null;
      launchDevServer(root, env, npmCmd);
    });
    startedServerOurselves = true;
    return;
  }
  launchDevServer(root, env, npmCmd);
}

/**
 * Prefer direct node + tsx (reliable under Electron on Windows).
 * Fall back to `npm run dev` with shell:true.
 * @param {string} root
 * @param {NodeJS.ProcessEnv} env
 * @param {string} npmCmd
 */
function launchDevServer(root, env, npmCmd) {
  appendAppLog(config, "Starting existing local API via tsx / npm run dev");
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const serverEntry = path.join(root, "dev", "server", "index.ts");
  const tsconfig = path.join(root, "tsconfig.dev.json");
  const apiLog = path.join(config.storageRoot, "logs", "local-api-spawn.log");
  fs.mkdirSync(path.dirname(apiLog), { recursive: true });
  const out = fs.openSync(apiLog, "a");

  const nodeCandidates = [
    process.env.npm_node_execpath,
    process.env.NODE_BINARY,
    "C:\\Program Files\\nodejs\\node.exe",
    "node",
  ].filter(Boolean);

  /** @type {string | null} */
  let nodeBin = null;
  for (const candidate of nodeCandidates) {
    if (candidate === "node" || fs.existsSync(candidate)) {
      // Prefer real Node — never Electron's execPath for the API child.
      if (String(candidate).toLowerCase().includes("electron")) continue;
      nodeBin = candidate;
      break;
    }
  }
  if (!nodeBin) nodeBin = "node";

  if (fs.existsSync(tsxCli) && fs.existsSync(serverEntry)) {
    appendAppLog(config, `Spawning API with ${nodeBin} + tsx`);
    serverProcess = spawn(nodeBin, [
      tsxCli,
      "--tsconfig",
      tsconfig,
      serverEntry,
    ], {
      cwd: root,
      env,
      stdio: ["ignore", out, out],
      windowsHide: true,
      shell: false,
    });
  } else {
    appendAppLog(config, "tsx not found — falling back to npm run dev (shell)");
    serverProcess = spawn(npmCmd, ["run", "dev"], {
      cwd: root,
      env,
      stdio: ["ignore", out, out],
      windowsHide: true,
      shell: true,
    });
  }
  startedServerOurselves = true;
  serverProcess.on("error", (error) => {
    appendAppLog(config, `Local API spawn error: ${error.message}`);
  });
  serverProcess.on("exit", (code) => {
    appendAppLog(config, `Local API process exited code=${code}`);
    serverProcess = null;
  });
}

async function isApiAlreadyRunning() {
  const result = await httpGetJson(healthUrl(), 2000);
  return Boolean(
    result.ok
    && result.body
    && typeof result.body === "object"
    && /** @type {{ ok?: boolean }} */ (result.body).ok,
  );
}

/**
 * Detect if configured port is occupied by a non-Kwizera process.
 * @returns {Promise<{ conflict: boolean; detail: string }>}
 */
async function detectPortConflict() {
  const result = await httpGetJson(healthUrl(), 1500);
  if (!result.ok) {
    // Nothing answering on health — try raw TCP-ish via health failure is enough;
    // if something else is on the port, /api/health will fail with non-JSON or wrong payload.
    return { conflict: false, detail: "Port appears free or not yet serving API." };
  }
  if (result.body && typeof result.body === "object") {
    const name = /** @type {{ name?: string }} */ (result.body).name;
    if (name === "KWIZERA AI STUDIO") {
      return { conflict: false, detail: "Kwizera API already on port." };
    }
    return {
      conflict: true,
      detail: `Port ${config.port} responded but is not KWIZERA AI STUDIO (name=${name ?? "unknown"}).`,
    };
  }
  return {
    conflict: true,
    detail: `Port ${config.port} is occupied by an unexpected service. Change KWIZERA_DEV_PORT or stop the other process.`,
  };
}

function createSplash() {
  const win = new BrowserWindow({
    width: 520,
    height: 420,
    frame: false,
    resizable: false,
    center: true,
    show: true,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void win.loadFile(path.join(__dirname, "splash", "index.html"));
  return win;
}

function createMainWindow() {
  const bounds = config.windowBounds;
  const win = new BrowserWindow({
    width: bounds?.width ?? 1440,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    show: false,
    icon: iconPath(),
    title: "KWIZERA AI STUDIO",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.on("close", (e) => {
    if (shuttingDown) return;
    e.preventDefault();
    void handleCloseRequest(win);
  });
  win.on("resized", () => persistWindow(win));
  win.on("moved", () => persistWindow(win));
  return win;
}

/**
 * @param {import("electron").BrowserWindow} win
 */
function persistWindow(win) {
  if (win.isDestroyed() || win.isMinimized()) return;
  const b = win.getBounds();
  config.windowBounds = b;
  saveDesktopConfig(config);
}

/**
 * @param {import("electron").BrowserWindow} win
 */
async function handleCloseRequest(win) {
  try {
    const status = await httpGetJson(statusUrl(), 2500);
    const jobs =
      status.ok && status.body && typeof status.body === "object"
        ? Number(
          /** @type {{ runtimeMetrics?: { activeJobs?: number } }} */ (status.body).runtimeMetrics
            ?.activeJobs ?? 0,
        )
        : 0;
    if (jobs > 0) {
      const choice = await dialog.showMessageBox(win, {
        type: "warning",
        title: "Production is currently running",
        message: "Production is currently running.",
        detail: `${jobs} active job(s) detected. Closing may interrupt work owned by this session.`,
        buttons: ["KEEP RUNNING", "STOP PRODUCTION & CLOSE", "CANCEL"],
        defaultId: 0,
        cancelId: 2,
      });
      if (choice.response === 0 || choice.response === 2) return;
    }
  } catch {
    /* proceed with close if status unreachable */
  }
  await gracefulShutdown();
  win.destroy();
  app.quit();
}

/**
 * @param {import("electron").BrowserWindow} splash
 */
async function runStartupSequence(splash) {
  lifecycle = "START";
  /** @type {Array<{ id: string; label: string; status: string; detail: string; required: boolean }>} */
  const checks = [];
  /**
   * @param {unknown} payload
   */
  const send = (payload) => {
    if (!splash.isDestroyed()) splash.webContents.send("startup:update", payload);
  };

  /**
   * @param {string} id
   * @param {string} label
   * @param {string} status
   * @param {string} detail
   * @param {boolean} required
   */
  const push = (id, label, status, detail, required) => {
    const item = { id, label, status, detail, required };
    const idx = checks.findIndex((c) => c.id === id);
    if (idx >= 0) checks[idx] = item;
    else checks.push(item);
    send({ lifecycle, checks, internet: null });
    appendAppLog(config, `${label}: ${status} — ${detail}`);
  };

  push("config", "Configuration", "CHECKING", "Loading local desktop config…", true);
  ensureAppDirectories(config);
  push("config", "Configuration", "READY", `Config loaded · port ${config.port}`, true);

  push("dirs", "Storage", "CHECKING", config.storageRoot, true);
  try {
    fs.mkdirSync(config.storageRoot, { recursive: true });
    push("dirs", "Storage", "READY", config.storageRoot, true);
  } catch (error) {
    push("dirs", "Storage", "FAILED", error instanceof Error ? error.message : "Storage unavailable", true);
    return { ok: false, checks, error: "Storage unavailable" };
  }

  push("database", "Database", "CHECKING", "Verifying database directory…", true);
  const dbDir = path.join(config.storageRoot, "database");
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    push("database", "Database", "READY", dbDir, true);
  } catch (error) {
    push(
      "database",
      "Database",
      "FAILED",
      error instanceof Error ? error.message : "Database path failed",
      true,
    );
    return { ok: false, checks, error: "Database unavailable" };
  }

  push("api", "Local API", "CHECKING", healthUrl(), true);
  const already = await isApiAlreadyRunning();
  if (already) {
    push("api", "Local API", "READY", "Existing local API detected — reusing (no duplicate server).", true);
  } else {
    const conflict = await detectPortConflict();
    // If something responds on health with wrong body we already handled in isApiAlreadyRunning.
    // Probe a generic GET to host:port — if connection succeeds but not our API, fail clearly.
    if (conflict.conflict) {
      push("api", "Local API", "FAILED", conflict.detail, true);
      return { ok: false, checks, error: conflict.detail };
    }
    push("api", "Local API", "STARTING", "Starting existing Node local API (first boot can take several minutes)…", true);
    try {
      startLocalApi(projectRoot());
    } catch (error) {
      push("api", "Local API", "FAILED", error instanceof Error ? error.message : "Failed to start API", true);
      return { ok: false, checks, error: "Local API failed to start" };
    }
    const health = await waitForHealth(300);
    if (!health.ready) {
      push("api", "Local API", "FAILED", health.error || "Health check timed out", true);
      return { ok: false, checks, error: health.error };
    }
    push("api", "Local API", "READY", "Health endpoint OK", true);
  }

  push("ai", "AI Services", "CHECKING", "Probing runtime / models…", false);
  const status = await httpGetJson(statusUrl(), 4000);
  const aiReady =
    status.ok && status.body && typeof status.body === "object"
      ? Boolean(/** @type {{ aiCore?: boolean }} */ (status.body).aiCore)
      : false;
  const models = detectLocalAi(projectRoot());
  if (aiReady) {
    push("ai", "AI Services", "READY", "Runtime reports AI core ready", false);
  } else {
    push("ai", "AI Services", "WARNING", models.note, false);
  }

  push("workspace", "Workspace", "STARTING", "Loading desktop UI…", true);
  const online = await probeInternet();
  send({
    lifecycle: "READY",
    checks,
    internet: online ? "ONLINE" : "OFFLINE",
    hardware: detectHardware(),
    models,
  });
  push("workspace", "Workspace", "READY", "Opening studio workspace…", true);

  lifecycle = "READY";
  return { ok: true, checks };
}

async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  lifecycle = "SHUTTING_DOWN";
  appendAppLog(config, "Shutdown started");
  if (mainWindow && !mainWindow.isDestroyed()) persistWindow(mainWindow);
  saveDesktopConfig(config);

  // Mark clean exit before stopping API so next launch is not treated as a crash
  try {
    await httpPostJson(`http://${config.host}:${config.port}/api/system-health/session/clean-exit`, {});
  } catch {
    /* API may already be down */
  }

  if (startedServerOurselves && serverProcess && !serverProcess.killed) {
    appendAppLog(config, "Stopping child local API process owned by desktop shell");
    try {
      if (process.platform === "win32" && serverProcess.pid) {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch (error) {
      appendAppLog(config, `Shutdown kill error: ${error instanceof Error ? error.message : String(error)}`);
    }
    serverProcess = null;
  }
  lifecycle = "STOPPED";
  appendAppLog(config, "Shutdown complete");
}

function registerIpc() {
  ipcMain.handle("app:getInfo", () => ({
    name: "KWIZERA AI STUDIO",
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    packaged: isPackaged,
    lifecycle,
    config: {
      host: config.host,
      port: config.port,
      storageRoot: config.storageRoot,
      environment: config.environment,
    },
  }));

  ipcMain.handle("app:getMachineStatus", () => detectHardware());
  ipcMain.handle("app:getLocalServiceStatus", async () => {
    const health = await httpGetJson(healthUrl(), 2500);
    const online = await probeInternet();
    return {
      api: health.ok ? "READY" : "FAILED",
      health: health.body,
      internet: online ? "ONLINE" : "OFFLINE",
      lifecycle,
      startedServerOurselves,
    };
  });
  ipcMain.handle("app:openLogs", async () => {
    const log = getLogPath(config);
    await shell.openPath(log);
    return { ok: true, path: log };
  });
  ipcMain.handle("app:restart", async () => {
    appendAppLog(config, "Restart requested");
    await gracefulShutdown();
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle("app:retryStartup", async () => {
    if (!splashWindow || splashWindow.isDestroyed()) {
      splashWindow = createSplash();
    }
    const result = await runStartupSequence(splashWindow);
    if (result.ok) await openWorkspace();
    return result;
  });
  ipcMain.handle("app:close", async () => {
    await gracefulShutdown();
    app.quit();
  });

  /** Native Windows file picker for product images (multi-select). */
  ipcMain.handle("dialog:openProductImages", async () => {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const result = await dialog.showOpenDialog(win, {
      title: "Add Product Images",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "tif", "tiff", "bmp"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePaths.length) {
      return { canceled: true, files: [] };
    }
    return { canceled: false, files: await readImageFilesForImport(result.filePaths) };
  });

  /** Native Windows folder picker — non-recursive image scan. */
  ipcMain.handle("dialog:openProductImageFolder", async () => {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const result = await dialog.showOpenDialog(win, {
      title: "Import Product Image Folder",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true, files: [], folder: null };
    }
    const folder = result.filePaths[0];
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    const paths = entries
      .filter((e) => e.isFile() && IMAGE_EXT_RE.test(e.name))
      .map((e) => path.join(folder, e.name));
    return {
      canceled: false,
      folder,
      files: await readImageFilesForImport(paths),
    };
  });
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|tiff?|bmp)$/i;
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/**
 * @param {string[]} filePaths
 * @returns {Promise<Array<{ name: string; mimeType: string; size: number; dataBase64: string; error?: string }>>}
 */
async function readImageFilesForImport(filePaths) {
  /** @type {Array<{ name: string; mimeType: string; size: number; dataBase64: string; error?: string }>} */
  const files = [];
  for (const filePath of filePaths) {
    const name = path.basename(filePath);
    try {
      if (!IMAGE_EXT_RE.test(name)) {
        files.push({ name, mimeType: "application/octet-stream", size: 0, dataBase64: "", error: "Unsupported format" });
        continue;
      }
      const resolved = path.resolve(filePath);
      // Reject obvious traversal / empty paths
      if (!resolved || resolved.includes("\0")) {
        files.push({ name, mimeType: "application/octet-stream", size: 0, dataBase64: "", error: "Invalid path" });
        continue;
      }
      const stat = fs.statSync(resolved);
      if (!stat.isFile() || stat.size <= 0) {
        files.push({ name, mimeType: mimeFromName(name), size: 0, dataBase64: "", error: "Empty or unreadable file" });
        continue;
      }
      if (stat.size > MAX_IMPORT_BYTES) {
        files.push({
          name,
          mimeType: mimeFromName(name),
          size: stat.size,
          dataBase64: "",
          error: "File exceeds 25 MB limit",
        });
        continue;
      }
      const buf = fs.readFileSync(resolved);
      files.push({
        name,
        mimeType: mimeFromName(name),
        size: buf.length,
        dataBase64: buf.toString("base64"),
      });
    } catch (error) {
      files.push({
        name,
        mimeType: "application/octet-stream",
        size: 0,
        dataBase64: "",
        error: error instanceof Error ? error.message : "Could not read file",
      });
    }
  }
  return files;
}

/** @param {string} name */
function mimeFromName(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  if (ext === ".bmp") return "image/bmp";
  return "application/octet-stream";
}

async function openWorkspace() {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
  lifecycle = "RUNNING";
  await mainWindow.loadURL(workspaceUrl());
  mainWindow.show();
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  config.lastWorkspace = "desktop";
  saveDesktopConfig(config);
  appendAppLog(config, `Workspace opened ${workspaceUrl()}`);
}

async function boot() {
  try {
    config = loadDesktopConfig(app.getPath("userData"));
    ensureAppDirectories(config);
    appendAppLog(config, `=== KWIZERA AI STUDIO desktop start v${app.getVersion()} ===`);
    registerIpc();

    splashWindow = createSplash();
    const result = await runStartupSequence(splashWindow);
    if (!result.ok) {
      lifecycle = "FAILED";
      if (!splashWindow.isDestroyed()) {
        splashWindow.webContents.send("startup:failed", {
          error: result.error,
          checks: result.checks,
        });
      }
      return;
    }
    await openWorkspace();
  } catch (error) {
    lifecycle = "FAILED";
    const message = error instanceof Error ? error.message : String(error);
    try {
      if (!config) config = loadDesktopConfig(app.getPath("userData"));
      appendAppLog(config, `Boot failed: ${message}`);
    } catch { /* ignore */ }
    if (!splashWindow || splashWindow.isDestroyed()) {
      splashWindow = createSplash();
    }
    if (!splashWindow.isDestroyed()) {
      splashWindow.webContents.send("startup:failed", {
        error: message,
        checks: [],
      });
    }
  }
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.kwizera.aistudio");
    }
    void boot();
  });

  app.on("window-all-closed", () => {
    void gracefulShutdown().finally(() => app.quit());
  });

  app.on("before-quit", (e) => {
    if (!shuttingDown) {
      e.preventDefault();
      void gracefulShutdown().finally(() => app.exit(0));
    }
  });
}
