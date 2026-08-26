/**
 * Live API smoke: Product Creation persistence across process restart (app reopen simulation).
 * Uses isolated KWIZERA_STORAGE_ROOT — does not touch production storage.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-persist-live-"));
const port = 5212;
const base = `http://127.0.0.1:${port}`;
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function httpJson(method, url, body, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* keep */
          }
          resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on("error", (e) => resolve({ ok: false, status: 0, body: String(e) }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: "timeout" });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitHealth(attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    const r = await httpJson("GET", `${base}/api/health`);
    if (r.ok && r.body?.ok) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function waitWorkspace(attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    const ws = await httpJson("GET", `${base}/api/workspace`);
    if (ws.ok) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function startServer() {
  const child = spawn(process.execPath, ["--import", "tsx", path.join(ROOT, "dev/server/index.ts")], {
    cwd: ROOT,
    env: {
      ...process.env,
      KWIZERA_STORAGE_ROOT: tmpRoot,
      KWIZERA_DEV_PORT: String(port),
      KWIZERA_PERSISTENT_MODE: "0",
      KWIZERA_SKIP_BROWSER_OPEN: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let log = "";
  child.stdout?.on("data", (d) => {
    log += d.toString();
  });
  child.stderr?.on("data", (d) => {
    log += d.toString();
  });
  return { child, getLog: () => log };
}

async function stopServer(child) {
  if (!child || child.killed) return;
  child.kill();
  await new Promise((r) => setTimeout(r, 1500));
  try {
    child.kill("SIGKILL");
  } catch {
    /* ignore */
  }
}

const results = [];
let projectId = null;
let projectIdB = null;

const first = startServer();
try {
  results.push({ id: "health-1", ok: await waitHealth() });
  results.push({ id: "workspace-1", ok: await waitWorkspace() });

  const created = await httpJson("POST", `${base}/api/workspace/projects`, {
    name: "KWIZERA-PERSISTENCE-TEST",
  });
  projectId = created.body?.project?.id ?? null;
  results.push({ id: "create-A", ok: created.ok && Boolean(projectId), detail: projectId });

  if (projectId) {
    for (let i = 0; i < 3; i++) {
      const up = await httpJson("POST", `${base}/api/workspace/projects/${projectId}/images`, {
        fileName: `persist-${i + 1}.png`,
        mimeType: "image/png",
        dataBase64: PNG,
        width: 1,
        height: 1,
      });
      results.push({ id: `upload-${i + 1}`, ok: up.ok && Boolean(up.body?.image?.id) });
    }

    const saved = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
      changes: {
        productInformation: {
          name: "Persist Bottle",
          category: "Beverage",
          description: "Persistence smoke product",
          price: 19.5,
          currency: "USD",
          sku: "SMOKE-P-001",
        },
        campaignInformation: {
          name: "Smoke Campaign",
          objective: "Awareness",
          callToAction: "Buy",
          contentFormat: "feed",
          platforms: ["instagram"],
        },
        targetAudience: "Testers",
        language: "en",
        platform: "instagram",
        workspaceSettings: {
          productCreation: {
            currentStep: 4,
            completedSteps: [1, 2, 3],
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    results.push({ id: "save-product-marketing-workflow", ok: saved.ok });

    const createdB = await httpJson("POST", `${base}/api/workspace/projects`, {
      name: "KWIZERA-PERSISTENCE-TEST-B",
    });
    projectIdB = createdB.body?.project?.id ?? null;
    results.push({ id: "create-B", ok: createdB.ok && Boolean(projectIdB) });
    if (projectIdB) {
      await httpJson("POST", `${base}/api/workspace/projects/${projectIdB}`, {
        changes: {
          productInformation: { name: "Product B Only", category: "B", description: "B" },
        },
      });
    }

    const health = await httpJson("GET", `${base}/api/workspace/persistence-health`);
    results.push({
      id: "persistence-health",
      ok: health.ok && health.body?.ok === true && health.body?.assetsOk >= 3,
      detail: {
        assetsOk: health.body?.assetsOk,
        orphanCount: health.body?.orphanCount,
        creativeWorkspaceRoot: health.body?.creativeWorkspaceRoot,
      },
    });

    const bak = await httpJson("POST", `${base}/api/workspace/persistence-backup`);
    results.push({ id: "persistence-backup", ok: bak.ok && bak.body?.ok === true, detail: bak.body?.path });
  }
} finally {
  await stopServer(first.child);
}

// Restart process — same storage root
const second = startServer();
try {
  results.push({ id: "health-2", ok: await waitHealth() });
  results.push({ id: "workspace-2", ok: await waitWorkspace() });

  if (projectId) {
    const opened = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
      action: "open",
    });
    const p = opened.body?.project;
    const wf = p?.workspaceSettings?.productCreation;
    const imagesOk = Array.isArray(p?.productImages) && p.productImages.length === 3;
    const productOk = p?.productInformation?.name === "Persist Bottle" && p?.productInformation?.sku === "SMOKE-P-001";
    const marketingOk = p?.campaignInformation?.objective === "Awareness" && p?.targetAudience === "Testers";
    const workflowOk = wf?.currentStep === 4 && Array.isArray(wf?.completedSteps) && wf.completedSteps.includes(3);
    results.push({
      id: "reopen-A-after-restart",
      ok: opened.ok && p?.id === projectId && p?.name === "KWIZERA-PERSISTENCE-TEST" && imagesOk && productOk && marketingOk && workflowOk,
      detail: {
        id: p?.id,
        images: p?.productImages?.length,
        product: p?.productInformation?.name,
        step: wf?.currentStep,
      },
    });

    // Verify files on disk
    const projectDir = path.join(tmpRoot, "creative-workspace", "projects", projectId);
    const projectJson = path.join(projectDir, "project.json");
    const imagesDir = path.join(projectDir, "images");
    let diskOk = fs.existsSync(projectJson);
    let imageFiles = 0;
    if (fs.existsSync(imagesDir)) {
      imageFiles = fs.readdirSync(imagesDir).filter((n) => !n.endsWith(".tmp")).length;
    }
    results.push({
      id: "filesystem-verify",
      ok: diskOk && imageFiles === 3,
      detail: { projectJson: diskOk, imageFiles, projectDir },
    });
  }

  if (projectIdB) {
    const openedB = await httpJson("POST", `${base}/api/workspace/projects/${projectIdB}`, { action: "open" });
    const switchA = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, { action: "open" });
    results.push({
      id: "switch-B-then-A",
      ok:
        openedB.body?.project?.productInformation?.name === "Product B Only"
        && switchA.body?.project?.productInformation?.name === "Persist Bottle",
    });
  }

  const health2 = await httpJson("GET", `${base}/api/workspace/persistence-health`);
  results.push({ id: "persistence-health-after-restart", ok: health2.ok && health2.body?.ok === true });
} finally {
  await stopServer(second.child);
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ tmpRoot, results, failed: failed.length }, null, 2));
if (failed.length) {
  console.error("FAILED:", failed.map((f) => f.id).join(", "));
  process.exit(1);
}
console.log("PERSISTENCE RESTART SMOKE: PASS");
process.exit(0);
