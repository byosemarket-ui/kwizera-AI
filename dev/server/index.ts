import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { spawn } from "node:child_process";

import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";

import {

  bootPersistentRuntime,

  getPersistentRuntime,

  getRuntimeStatus,

  getSessionStore,

  isPersistentMode,

  registerShutdownHandlers,

  saveRuntimeSnapshot,

  shutdownPersistentRuntime,

} from "../persistent/runtime.js";

import { buildRegistry, findModule, listAiModules, getProjectRoot, invalidateRegistryCache } from "./module-registry.js";

import { PHASE_DEFINITIONS } from "./phase-definitions.js";



const PORT = Number(process.env.KWIZERA_DEV_PORT ?? 5173);

const HOST = "127.0.0.1";

const UI_DIR = path.resolve(import.meta.dirname, "../ui");

const projectRoot = getProjectRoot();

const storageRoot = resolveStorageRoot();



let activePort = PORT;



console.log("[KWIZERA] Starting persistent local development environment…");

console.log("[KWIZERA] Storage root:", storageRoot);

registerShutdownHandlers();



function sendJson(res: ServerResponse, status: number, data: unknown): void {

  res.writeHead(status, {

    "Content-Type": "application/json",

    "Access-Control-Allow-Origin": "*",

  });

  res.end(JSON.stringify(data));

}



async function readBody(req: IncomingMessage): Promise<string> {

  return new Promise((resolve, reject) => {

    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => chunks.push(chunk));

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));

    req.on("error", reject);

  });

}



function contentType(filePath: string): string {

  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";

  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";

  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";

  if (filePath.endsWith(".png")) return "image/png";

  return "application/octet-stream";

}



function serveStatic(res: ServerResponse, filePath: string): void {

  if (!fs.existsSync(filePath)) {

    res.writeHead(404);

    res.end("Not found");

    return;

  }

  const data = fs.readFileSync(filePath);

  res.writeHead(200, { "Content-Type": contentType(filePath) });

  res.end(data);

}



function createIsolatedStorageRoot(): string {

  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-"));

}



function cleanupTemp(dir: string): void {

  try {

    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  } catch { /* ignore */ }

}



function pathToFileUrl(filePath: string): string {

  return `file:///${path.resolve(filePath).replace(/\\/g, "/")}`;

}



async function runSmokeTest(aiPath: string) {

  const start = Date.now();

  const distJs = path.join(projectRoot, "dist", aiPath, "index.js");

  const srcTs = path.join(projectRoot, aiPath, "index.ts");

  const target = fs.existsSync(distJs) ? distJs : srcTs;



  if (!fs.existsSync(target)) {

    return { success: false, durationMs: Date.now() - start, message: `Module not found: ${aiPath}`, output: "" };

  }



  try {

    const mod = await import(pathToFileUrl(target));

    const exportCount = Object.keys(mod).length;

    return {

      success: exportCount > 0,

      durationMs: Date.now() - start,

      message: `Module loaded (${exportCount} exports)`,

      output: `Loaded ${fs.existsSync(distJs) ? "dist" : "source"}/${aiPath}`,

    };

  } catch (err) {

    const message = err instanceof Error ? err.message : String(err);

    return { success: false, durationMs: Date.now() - start, message, output: message };

  }

}



async function runValidationScript(validateKey: string) {

  const start = Date.now();

  const isolatedRoot = createIsolatedStorageRoot();

  return new Promise<{ success: boolean; durationMs: number; message: string; output: string }>((resolve) => {

    const child = spawn(

      process.platform === "win32" ? "npm.cmd" : "npm",

      ["run", `validate:${validateKey}`],

      { cwd: projectRoot, env: { ...process.env, KWIZERA_STORAGE_ROOT: isolatedRoot }, shell: true }

    );

    let output = "";

    child.stdout.on("data", (d: Buffer) => { output += d.toString(); });

    child.stderr.on("data", (d: Buffer) => { output += d.toString(); });

    child.on("close", (code) => {

      cleanupTemp(isolatedRoot);

      resolve({

        success: code === 0,

        durationMs: Date.now() - start,

        message: code === 0 ? "Validation passed" : `Validation failed (exit ${code})`,

        output: output.slice(-8000),

      });

    });

    child.on("error", (err) => {

      cleanupTemp(isolatedRoot);

      resolve({ success: false, durationMs: Date.now() - start, message: err.message, output });

    });

  });

}



async function runEngineQuickTest(engineName: string) {

  const start = Date.now();

  const persistentCore = getPersistentRuntime();



  if (persistentCore?.getManager().isReady()) {

    const manager = persistentCore.getManager();

    const health = manager.controller.getHealthReport();

    const report = persistentCore.getStatusReport();

    const success = health.healthy && report.readinessScore >= 80;

    return {

      success,

      durationMs: Date.now() - start,

      message: `${engineName}: persistent runtime readiness ${report.readinessScore}/100`,

      output: JSON.stringify({

        mode: "persistent",

        storageRoot,

        healthy: health.healthy,

        readinessScore: report.readinessScore,

        lifecycle: manager.getLifecycleState(),

      }, null, 2),

    };

  }



  const isolatedRoot = createIsolatedStorageRoot();

  try {

    const { createAiCore } = await import("../../ai/core/index.js");

    const core = createAiCore({ storageRootOverride: isolatedRoot });

    await core.start("dev-quick-test");

    const health = core.getManager().controller.getHealthReport();

    const report = core.getStatusReport();

    await core.stop("dev quick test");

    cleanupTemp(isolatedRoot);

    const success = health.healthy && report.readinessScore >= 80;

    return {

      success,

      durationMs: Date.now() - start,

      message: `${engineName}: readiness ${report.readinessScore}/100`,

      output: JSON.stringify({ mode: "isolated", healthy: health.healthy, readinessScore: report.readinessScore }, null, 2),

    };

  } catch (err) {

    cleanupTemp(isolatedRoot);

    const message = err instanceof Error ? err.message : String(err);

    return { success: false, durationMs: Date.now() - start, message, output: message };

  }

}



async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {

  if (req.method === "OPTIONS") {

    res.writeHead(204, {

      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",

      "Access-Control-Allow-Headers": "Content-Type",

    });

    res.end();

    return;

  }



  if (url.pathname === "/api/health") {

    const runtime = getRuntimeStatus();

    sendJson(res, 200, {

      ok: true,

      name: "KWIZERA AI STUDIO",

      mode: isPersistentMode() ? "persistent-local-development" : "local-development",

      host: HOST,

      port: activePort,

      storageRoot,

      persistent: isPersistentMode(),

      runtimeReady: runtime?.ready ?? false,

      sessionRestored: runtime?.restored ?? false,

    });

    return;

  }



  if (url.pathname === "/api/session") {

    const store = getSessionStore();

    const runtime = getRuntimeStatus();

    sendJson(res, 200, {

      session: store?.get() ?? null,

      runtime,

    });

    return;

  }



  if (url.pathname === "/api/session/ui" && req.method === "POST") {

    const store = getSessionStore();

    if (!store) {

      sendJson(res, 503, { error: "Session store not ready" });

      return;

    }

    try {

      const body = JSON.parse(await readBody(req)) as { filter?: string; openPhases?: string[] };

      store.updateUi({

        filter: body.filter ?? store.get().ui.filter,

        openPhases: body.openPhases ?? store.get().ui.openPhases,

      });

      sendJson(res, 200, { ok: true, ui: store.get().ui });

    } catch {

      sendJson(res, 400, { error: "Invalid session UI payload" });

    }

    return;

  }



  if (url.pathname === "/api/runtime") {

    sendJson(res, 200, { runtime: getRuntimeStatus() });

    return;

  }



  if (url.pathname === "/api/phases") {

    const refresh = url.searchParams.get("refresh") === "1";

    sendJson(res, 200, { phases: buildRegistry(refresh) });

    return;

  }



  if (url.pathname === "/api/engines") {

    sendJson(res, 200, {

      engines: PHASE_DEFINITIONS.filter((p) => p.phase > 1).map((p) => ({

        id: p.id, phase: p.phase, name: p.engine, description: p.description,

      })),

    });

    return;

  }



  if (url.pathname === "/api/modules/ai") {

    const modules = listAiModules();

    sendJson(res, 200, { modules, count: modules.length });

    return;

  }



  if (url.pathname === "/api/logo") {

    serveStatic(res, path.join(projectRoot, "KWIZERA AI.png"));

    return;

  }



  const engineMatch = url.pathname.match(/^\/api\/engines\/([^/]+)\/quick-test$/);

  if (req.method === "POST" && engineMatch) {

    const phase = PHASE_DEFINITIONS.find((p) => p.id === engineMatch[1]);

    if (!phase) { sendJson(res, 404, { error: "Engine not found" }); return; }

    const result = await runEngineQuickTest(phase.engine);

    sendJson(res, 200, result);

    return;

  }



  const smokeMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/smoke-test$/);

  if (req.method === "POST" && smokeMatch) {

    const mod = findModule(smokeMatch[1]);

    if (!mod?.aiPath) { sendJson(res, 404, { error: "Module not found" }); return; }

    const result = await runSmokeTest(mod.aiPath);

    sendJson(res, 200, result);

    return;

  }



  const validateMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/validate$/);

  if (req.method === "POST" && validateMatch) {

    const mod = findModule(validateMatch[1]);

    if (!mod?.validateKey) { sendJson(res, 404, { error: "Validation script not found" }); return; }

    const result = await runValidationScript(mod.validateKey);

    if (result.success) invalidateRegistryCache();

    sendJson(res, 200, result);

    return;

  }



  sendJson(res, 404, { error: "Not found" });

}



const server = createServer(async (req, res) => {

  const url = new URL(req.url ?? "/", `http://${HOST}:${activePort}`);



  if (url.pathname.startsWith("/api/")) {

    await handleApi(req, res, url);

    return;

  }



  let filePath = url.pathname === "/" ? path.join(UI_DIR, "index.html") : path.join(UI_DIR, url.pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {

    filePath = path.join(UI_DIR, "index.html");

  }

  serveStatic(res, filePath);

});



function openBrowser(address: string): void {

  if (process.env.KWIZERA_SKIP_BROWSER_OPEN === "1") return;

  if (process.platform === "win32") {

    spawn("cmd", ["/c", "start", "chrome", address], { detached: true, stdio: "ignore" }).unref();

  }

}



function printStartupBanner(port: number, restored: boolean): void {

  const address = `http://${HOST}:${port}`;

  console.log("");

  console.log("  KWIZERA AI STUDIO — Persistent Local Development");

  console.log(`  Dashboard: ${address}`);

  console.log(`  Storage:   ${storageRoot}`);

  console.log(`  Session:   ${restored ? "restored from previous run" : "initialized"}`);

  console.log("  Offline only — not deployed");

  console.log("");

  openBrowser(address);

}



function startListening(port: number): void {

  server.once("error", (err: NodeJS.ErrnoException) => {

    if (err.code === "EADDRINUSE") {

      console.error(`[KWIZERA] Port ${port} is already in use.`);

      console.error(`  Stop the other process, or run: $env:KWIZERA_DEV_PORT=5174; npm run dev`);

      process.exit(1);

    }

    console.error("[KWIZERA] Server error:", err);

    process.exit(1);

  });



  server.listen(port, HOST, () => {

    activePort = port;

    const runtime = getRuntimeStatus();

    printStartupBanner(port, runtime?.restored ?? false);



    if (process.env.KWIZERA_AUTO_START === "1") {

      getSessionStore()?.markAutoStart(true);

    }

  });

}



async function main(): Promise<void> {

  process.env.KWIZERA_PERSISTENT_MODE ??= "1";

  process.env.KWIZERA_STORAGE_ROOT ??= storageRoot;



  startListening(PORT);

  void bootPersistentRuntime(HOST, PORT).then((runtime) => {
    console.log(`[KWIZERA] ${runtime.message}`);
    void saveRuntimeSnapshot();
  }).catch((err) => {
    console.error("[KWIZERA] Background runtime boot error:", err);
  });

}



main().catch((err) => {

  console.error("[KWIZERA] Fatal startup error:", err);

  process.exit(1);

});


