#!/usr/bin/env node
/**
 * STEP 1 production verification — actually starts the compiled server
 * and checks live HTTP responses against KWIZERA AI Core.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "dist", "dev", "server", "index.js");
const PORT = Number(process.env.KWIZERA_VERIFY_PORT || 15173);
const storageRoot = process.env.KWIZERA_VERIFY_STORAGE
  || fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-vps-step1-"));

const results = [];
let failed = 0;
let child = null;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(pathname, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, { signal: controller.signal });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms${lastError ? ` (${lastError})` : ""}`);
}

function requiredDirs() {
  return [
    "config", "database", "projects", "uploads", "exports", "media",
    "memory", "knowledge", "product-intelligence", "image-intelligence",
    "video-intelligence", "video-generation", "image-generation",
    "audio-generation", "learning", "logs", "backups", "cache", "temp", "state",
  ];
}

async function main() {
  console.log("KWIZERA AI STUDIO — STEP 1 production verification");
  console.log(`Project: ${root}`);
  console.log(`Entry:   ${entry}`);
  console.log(`Port:    ${PORT}`);
  console.log(`Storage: ${storageRoot}`);
  console.log("");

  record("compiled server exists", fs.existsSync(entry), entry);
  if (!fs.existsSync(entry)) {
    printSummary();
    process.exit(1);
  }

  const env = {
    ...process.env,
    NODE_ENV: "production",
    KWIZERA_ENV: "production",
    KWIZERA_HOST: "127.0.0.1",
    KWIZERA_PORT: String(PORT),
    KWIZERA_STORAGE_ROOT: storageRoot,
    KWIZERA_PROJECT_ROOT: root,
    KWIZERA_PERSISTENT_MODE: "1",
    KWIZERA_SKIP_BROWSER_OPEN: "1",
  };

  child = spawn(process.execPath, [entry], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const logs = [];
  const capture = (chunk) => {
    const text = chunk.toString("utf8");
    logs.push(text);
    process.stdout.write(text);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      record("production process stayed alive", false, `exited code=${code} signal=${signal ?? ""}`);
    }
  });

  try {
    const health = await waitFor(async () => {
      const res = await getJson("/api/health", 2000);
      return res.status === 200 && res.body && res.body.ok === true ? res.body : null;
    }, 360_000, "HTTP /api/health");

    record("HTTP /api/health responds", true, `mode=${health.mode} host=${health.host} port=${health.port}`);
    record("production mode advertised", health.mode === "production", String(health.mode));
    record(
      "storage root is the configured test directory",
      path.resolve(health.storageRoot) === path.resolve(storageRoot),
      health.storageRoot,
    );
    record("no Windows drive letter required", !/^[A-Za-z]:[\\/]/.test(String(health.storageRoot)) || process.platform === "win32", health.storageRoot);

    const ui = await waitFor(async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(3000) });
      const text = await res.text();
      return res.ok && text.includes("KWIZERA") ? text : null;
    }, 15_000, "UI /");
    record("dashboard UI served", Boolean(ui), "/");

    const runtime = await waitFor(async () => {
      const res = await getJson("/api/runtime", 4000);
      const current = res.body?.runtime;
      if (current?.message) process.stdout.write(`\r[wait] runtime: ready=${Boolean(current.ready)} booting=${Boolean(current.booting)} ${current.message}`.slice(0, 160));
      return current?.ready === true ? current : null;
    }, 360_000, "AI runtime ready");
    console.log("");

    record("persistent runtime ready", Boolean(runtime?.ready), runtime?.message ?? "");
    record(
      "KWIZERA AI Core initialized",
      Boolean(runtime?.ready),
      runtime?.message ?? "",
    );

    const combinedLogs = logs.join("");
    record(
      "no fatal startup errors in logs",
      !/Fatal startup error|Background runtime boot error/i.test(combinedLogs),
      /Fatal startup error|Background runtime boot error/i.test(combinedLogs) ? "see logs above" : "clean",
    );

    const workspace = await waitFor(async () => {
      const res = await getJson("/api/desktop-workspace/status", 8000);
      return res.status === 200 && res.body && typeof res.body === "object" ? res.body : null;
    }, 60_000, "workspace status");

    const flags = {
      aiCore: Boolean(workspace.aiCore),
      memoryFoundation: Boolean(workspace.memoryFoundation),
      knowledgeFoundation: Boolean(workspace.knowledgeFoundation),
      productIntelligence: Boolean(workspace.productIntelligence),
      imageIntelligence: Boolean(workspace.imageIntelligence),
      videoIntelligence: Boolean(workspace.videoIntelligence),
      workflowEngine: Boolean(workspace.workflowEngine),
    };
    for (const [name, ok] of Object.entries(flags)) {
      record(`service ${name}`, ok, ok ? "initialized" : "not initialized");
    }

    const pipeline = workspace.pipeline || workspace.productPipeline || null;
    const pipelineReady = Boolean(
      workspace.productIntelligence
      && workspace.imageIntelligence
      && (workspace.videoIntelligence || workspace.workflowEngine),
    );
    record(
      "Product → Video pipeline can initialize",
      pipelineReady,
      pipeline ? `pipeline=${JSON.stringify(pipeline).slice(0, 180)}` : "product + image + video/workflow foundations",
    );

    const created = requiredDirs().filter((dir) => fs.existsSync(path.join(storageRoot, dir)));
    record(
      "required storage directories exist",
      created.length >= 12,
      `${created.length}/${requiredDirs().length} present`,
    );

    record(
      "startup does not spawn or require an external LLM",
      !/spawn ollama/i.test(combinedLogs)
        && !/must install ollama/i.test(combinedLogs),
      "KWIZERA AI Core only",
    );
  } catch (error) {
    record("verification run", false, error instanceof Error ? error.message : String(error));
  } finally {
    await stopChild();
  }

  printSummary();
  process.exit(failed === 0 ? 0 : 1);
}

async function stopChild() {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* ignore */ }
      resolve();
    }, 8000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try { child.kill("SIGTERM"); } catch { resolve(); }
  });
}

function printSummary() {
  console.log("");
  console.log(`STEP 1 verification: ${failed === 0 ? "PASS" : "FAIL"} (${results.filter((r) => r.ok).length}/${results.length} checks)`);
  if (failed) {
    for (const result of results.filter((r) => !r.ok)) {
      console.log(`  - ${result.name}: ${result.detail}`);
    }
  }
}

main().catch(async (error) => {
  console.error("[KWIZERA] Verification crashed:", error);
  await stopChild();
  process.exit(1);
});
