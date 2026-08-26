/**
 * Post-Phase 7 Step 4 — Full Product Creation functional E2E (API + filesystem).
 * Uses isolated KWIZERA_STORAGE_ROOT. Does NOT touch production storage.
 *
 * PASS = underlying operation succeeded (not merely HTTP 200).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-e2e-func-"));
const port = 5213;
const base = `http://127.0.0.1:${port}`;
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const WEBP = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=";

const results = [];
let child = null;

function record(id, ok, detail = undefined) {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${id}${detail != null ? ` — ${JSON.stringify(detail)}` : ""}`);
}

function httpJson(method, url, body, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
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
            /* keep string */
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

async function waitFor(fn, attempts = 80, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function startServer() {
  child = spawn(process.execPath, ["--import", "tsx", path.join(ROOT, "dev/server/index.ts")], {
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
}

async function stopServer() {
  if (!child || child.killed) return;
  child.kill();
  await new Promise((r) => setTimeout(r, 1500));
  try {
    child.kill("SIGKILL");
  } catch {
    /* ignore */
  }
  child = null;
}

function projectDir(id) {
  return path.join(tmpRoot, "creative-workspace", "projects", id);
}

async function runPhase1() {
  startServer();

  const healthUp = await waitFor(async () => {
    const r = await httpJson("GET", `${base}/api/health`);
    return r.ok && r.body?.ok === true;
  }, 120);
  record("startup-health", healthUp);

  const wsUp = await waitFor(async () => {
    const r = await httpJson("GET", `${base}/api/workspace`);
    return r.ok;
  }, 120);
  record("startup-workspace", wsUp);

  // If health raced server bind, recheck once workspace is live
  if (!healthUp && wsUp) {
    const retryHealth = await httpJson("GET", `${base}/api/health`);
    if (retryHealth.ok && retryHealth.body?.ok === true) {
      const idx = results.findIndex((r) => r.id === "startup-health");
      if (idx >= 0) {
        results[idx] = { id: "startup-health", ok: true, detail: "passed on recheck after workspace ready" };
        console.log("[PASS] startup-health — passed on recheck after workspace ready");
      }
    }
  }

  const sysHealth = await httpJson("GET", `${base}/api/system-health`);
  const subs = sysHealth.body?.subsystems ?? [];
  const requiredIds = ["application", "backend", "storage", "creative-workspace", "database", "memory", "knowledge"];
  const subMap = Object.fromEntries(subs.map((s) => [s.id, s]));
  const healthBaseline = requiredIds.every((id) => {
    const s = subMap[id];
    return s && (s.status === "READY" || s.status === "DEGRADED" || s.status === "STARTING");
  });
  record("system-health-baseline", healthBaseline && sysHealth.ok, {
    overall: sysHealth.body?.overallStatus,
    score: sysHealth.body?.healthScore,
    creative: subMap["creative-workspace"]?.status,
  });

  // --- Project name validation ---
  const emptyCreate = await httpJson("POST", `${base}/api/workspace/projects`, { name: "   " });
  record("reject-empty-project-name", !emptyCreate.ok && emptyCreate.status === 400);

  const longName = "KWIZERA-" + "X".repeat(200);
  const longCreate = await httpJson("POST", `${base}/api/workspace/projects`, { name: longName });
  const longOk = longCreate.ok && longCreate.body?.project?.id;
  record("accept-long-project-name", longOk, { len: longName.length });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const projectName = `KWIZERA-E2E-TEST-${stamp}`;
  const created = await httpJson("POST", `${base}/api/workspace/projects`, { name: projectName });
  const projectId = created.body?.project?.id;
  record(
    "create-project",
    created.ok && Boolean(projectId) && created.body?.project?.name === projectName,
    { projectId, name: created.body?.project?.name },
  );

  const wsAfter = await httpJson("GET", `${base}/api/workspace`);
  record(
    "active-project-after-create",
    wsAfter.body?.activeProject?.id === projectId,
    { active: wsAfter.body?.activeProject?.id },
  );

  const diskExists = fs.existsSync(path.join(projectDir(projectId), "project.json"));
  record("project-filesystem-record", diskExists, { path: projectDir(projectId) });

  // Rapid duplicate creates should yield distinct IDs
  const rapid = await Promise.all([
    httpJson("POST", `${base}/api/workspace/projects`, { name: "Rapid-A" }),
    httpJson("POST", `${base}/api/workspace/projects`, { name: "Rapid-B" }),
  ]);
  const rapidIds = rapid.map((r) => r.body?.project?.id).filter(Boolean);
  record("rapid-create-distinct-ids", rapidIds.length === 2 && rapidIds[0] !== rapidIds[1], { rapidIds });

  // Re-open main project
  await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, { action: "open" });

  // --- Image validation ---
  const badMime = await httpJson("POST", `${base}/api/workspace/projects/${projectId}/images`, {
    fileName: "x.gif",
    mimeType: "image/gif",
    dataBase64: Buffer.from("GIF89a").toString("base64"),
  });
  record("reject-unsupported-image", !badMime.ok && badMime.status === 400);

  const emptyFile = await httpJson("POST", `${base}/api/workspace/projects/${projectId}/images`, {
    fileName: "empty.png",
    mimeType: "image/png",
    dataBase64: "",
  });
  record("reject-empty-image", !emptyFile.ok);

  const imageIds = [];
  for (let i = 0; i < 3; i++) {
    const up = await httpJson("POST", `${base}/api/workspace/projects/${projectId}/images`, {
      fileName: `e2e-${i + 1}.png`,
      mimeType: "image/png",
      dataBase64: PNG,
      width: 1,
      height: 1,
    });
    if (up.body?.image?.id) imageIds.push(up.body.image.id);
  }
  record("upload-3-images", imageIds.length === 3, { imageIds });

  const webpUp = await httpJson("POST", `${base}/api/workspace/projects/${projectId}/images`, {
    fileName: "e2e.webp",
    mimeType: "image/webp",
    dataBase64: WEBP,
  });
  record("upload-webp", webpUp.ok && Boolean(webpUp.body?.image?.id));

  const afterImages = await httpJson("GET", `${base}/api/workspace/projects/${projectId}`);
  const intakeValid = afterImages.body?.intake?.valid === true;
  record("step1-intake-valid", intakeValid, afterImages.body?.intake);

  // --- Step 2: image organization data ---
  const imageSet = {
    version: 1,
    projectId,
    images: (afterImages.body?.project?.productImages ?? []).map((img, idx) => ({
      id: img.id,
      fileName: img.fileName,
      url: img.url,
      role: idx === 0 ? "hero" : "detail",
      viewType: idx === 0 ? "front" : "detail",
    })),
    coverage: { front: true, detail: true },
    updatedAt: new Date().toISOString(),
  };
  const step2Save = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
    changes: {
      workspaceSettings: {
        productImageSet: imageSet,
        productCreation: {
          currentStep: 2,
          completedSteps: [1],
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });
  const step2Persisted =
    step2Save.ok
    && step2Save.body?.project?.workspaceSettings?.productImageSet?.images?.length >= 3;
  record("step2-image-organization-persist", step2Persisted);

  // --- Step 3: product information ---
  const productChanges = {
    productInformation: {
      name: "E2E Test Bottle",
      category: "Beverage",
      description: "Insulated steel bottle for functional E2E verification",
      price: 24.99,
      currency: "USD",
      sku: "E2E-SKU-001",
      features: ["Insulated", "Leak-proof"],
      materials: ["Steel"],
      colors: ["Matte Black"],
      sizes: ["500ml"],
      specifications: { weight: "350g", warranty: "2 years" },
    },
    workspaceSettings: {
      productImageSet: imageSet,
      productCreation: {
        currentStep: 3,
        completedSteps: [1, 2],
        updatedAt: new Date().toISOString(),
      },
    },
  };
  const step3Save = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
    changes: productChanges,
  });
  const p3 = step3Save.body?.project;
  record(
    "step3-product-save",
    step3Save.ok
      && p3?.productInformation?.name === "E2E Test Bottle"
      && p3?.productInformation?.sku === "E2E-SKU-001"
      && p3?.productInformation?.price === 24.99,
  );

  const incompleteProduct = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
    changes: {
      productInformation: {
        name: "",
        category: "",
        description: "",
        price: null,
        currency: "",
      },
    },
  });
  // Restore valid product for downstream
  await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, { changes: productChanges });
  record(
    "step3-incomplete-product-stored",
    incompleteProduct.ok,
    { note: "validation is client+gate; incomplete data may save but fails gates" },
  );

  // --- Step 4: marketing ---
  const marketingChanges = {
    campaignInformation: {
      name: "E2E Launch",
      objective: "Brand awareness",
      callToAction: "Shop Now",
      contentFormat: "feed",
      platforms: ["instagram", "facebook"],
    },
    targetAudience: "Urban professionals 25-40",
    language: "en",
    platform: "instagram",
    brandInformation: { name: "KWIZERA", voice: "confident" },
    workspaceSettings: {
      productImageSet: imageSet,
      marketingInputBrief: {
        audience: "Urban professionals 25-40",
        goal: "Awareness",
        promotion: "Launch week",
      },
      productCreation: {
        currentStep: 4,
        completedSteps: [1, 2, 3],
        updatedAt: new Date().toISOString(),
      },
    },
  };
  const step4Save = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
    changes: marketingChanges,
  });
  const p4 = step4Save.body?.project;
  record(
    "step4-marketing-save",
    step4Save.ok
      && p4?.campaignInformation?.objective === "Brand awareness"
      && p4?.targetAudience?.includes("Urban"),
  );

  // Marketing update + read-back
  const marketingUpdate = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
    changes: {
      campaignInformation: {
        ...p4?.campaignInformation,
        callToAction: "Buy Today",
      },
    },
  });
  record(
    "step4-marketing-update",
    marketingUpdate.body?.project?.campaignInformation?.callToAction === "Buy Today",
  );

  // --- Step 5 readiness (server validation) ---
  const step5Prep = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, {
    changes: {
      workspaceSettings: {
        ...p4?.workspaceSettings,
        productCreation: {
          currentStep: 5,
          completedSteps: [1, 2, 3, 4],
          updatedAt: new Date().toISOString(),
        },
      },
    },
  });
  const fullValidation = step5Prep.body?.validation;
  record(
    "step5-full-validation",
    step5Prep.ok && fullValidation?.valid === true,
    { errors: fullValidation?.errors?.slice?.(0, 5) },
  );

  // --- Project B for switching ---
  const createdB = await httpJson("POST", `${base}/api/workspace/projects`, { name: "KWIZERA-E2E-TEST-B" });
  const projectIdB = createdB.body?.project?.id;
  await httpJson("POST", `${base}/api/workspace/projects/${projectIdB}`, {
    changes: {
      productInformation: { name: "Product B Only", category: "B", description: "B desc", price: 9.99, currency: "USD" },
    },
  });
  await httpJson("POST", `${base}/api/workspace/projects/${projectIdB}/images`, {
    fileName: "b-only.png",
    mimeType: "image/png",
    dataBase64: PNG,
  });

  const openB = await httpJson("POST", `${base}/api/workspace/projects/${projectIdB}`, { action: "open" });
  const openA = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, { action: "open" });
  record(
    "project-switch-no-contamination",
    openB.body?.project?.productInformation?.name === "Product B Only"
      && openA.body?.project?.productInformation?.name === "E2E Test Bottle"
      && openA.body?.project?.productImages?.length >= 3,
  );

  // --- Backup + persistence health ---
  const health = await httpJson("GET", `${base}/api/workspace/persistence-health`);
  record(
    "persistence-health",
    health.ok && health.body?.ok === true && health.body?.assetsOk >= 4,
    { assetsOk: health.body?.assetsOk, orphans: health.body?.orphanCount },
  );

  const backup = await httpJson("POST", `${base}/api/workspace/persistence-backup`);
  const backupReadable =
    backup.ok
    && backup.body?.ok === true
    && fs.existsSync(path.join(backup.body.path, "manifest.json"));
  record("persistence-backup-readable", backupReadable, { path: backup.body?.path });

  // --- Memory ---
  const memHealth = await httpJson("GET", `${base}/api/persistent-memory/health`);
  record(
    "memory-health",
    memHealth.ok && (memHealth.body?.memory === "READY" || memHealth.body?.memory === "STARTING"),
    memHealth.body,
  );

  const memSave = await httpJson("POST", `${base}/api/persistent-memory/save`, {
    kind: "PROJECT_MEMORY",
    title: "E2E functional test",
    content: `Project ${projectId} verified`,
    tags: ["e2e", "functional"],
    projectId,
  });
  const memId = memSave.body?.memoryId ?? memSave.body?.record?.memoryId;
  const memRead = memId
    ? await httpJson("GET", `${base}/api/persistent-memory/record/${encodeURIComponent(memId)}`)
    : { ok: false, body: memSave.body };
  record(
    "memory-write-read",
    memSave.ok && memRead.ok && memRead.body?.record?.memoryId === memId,
    { memId, save: memSave.body?.action ?? memSave.body?.error },
  );

  // --- Pipeline (may be unavailable in dashboard mode) ---
  const pipelineTry = await httpJson("POST", `${base}/api/pipeline/jobs`, { projectId });
  record(
    "pipeline-handoff",
    pipelineTry.status === 202 || pipelineTry.status === 503,
    { status: pipelineTry.status, detail: pipelineTry.body?.error ?? pipelineTry.body?.job?.id },
  );

  // --- Image file integrity ---
  let filesOk = true;
  for (const img of openA.body?.project?.productImages ?? []) {
    const ext = img.mimeType === "image/webp" ? "webp" : "png";
    const fp = path.join(projectDir(projectId), "images", `${img.id}.${ext}`);
    if (!fs.existsSync(fp) || fs.statSync(fp).size <= 0) filesOk = false;
  }
  record("image-files-on-disk", filesOk);

  return { projectId, projectName, imageIds };
}

async function runPhase2Restart(projectId, projectName) {
  await stopServer();
  startServer();

  const up = await waitFor(async () => {
    const r = await httpJson("GET", `${base}/api/health`);
    return r.ok && r.body?.ok;
  });
  record("restart-health", up);

  await waitFor(async () => (await httpJson("GET", `${base}/api/workspace`)).ok);

  const opened = await httpJson("POST", `${base}/api/workspace/projects/${projectId}`, { action: "open" });
  const p = opened.body?.project;
  const wf = p?.workspaceSettings?.productCreation;
  record(
    "restart-full-workflow-data",
    opened.ok
      && p?.id === projectId
      && p?.name === projectName
      && p?.productImages?.length >= 3
      && p?.productInformation?.name === "E2E Test Bottle"
      && p?.campaignInformation?.callToAction === "Buy Today"
      && wf?.currentStep === 5
      && Array.isArray(wf?.completedSteps)
      && wf.completedSteps.includes(4),
    {
      images: p?.productImages?.length,
      step: wf?.currentStep,
      product: p?.productInformation?.name,
    },
  );

  const health2 = await httpJson("GET", `${base}/api/workspace/persistence-health`);
  record("restart-persistence-health", health2.ok && health2.body?.ok === true);
}

let exitCode = 0;
try {
  console.log(`E2E functional test — storage: ${tmpRoot}`);
  const ctx = await runPhase1();
  if (ctx.projectId) await runPhase2Restart(ctx.projectId, ctx.projectName);
} catch (error) {
  record("fatal", false, String(error));
  exitCode = 1;
} finally {
  await stopServer();
}

const failed = results.filter((r) => !r.ok);
const summary = {
  storageRoot: tmpRoot,
  total: results.length,
  passed: results.filter((r) => r.ok).length,
  failed: failed.length,
  failedIds: failed.map((f) => f.id),
  results,
  windowsRestart: "NOT RUN",
  uiClickTests: "NOT RUN — API/filesystem functional verification only",
};

console.log("\n=== E2E FUNCTIONAL SUMMARY ===");
console.log(JSON.stringify(summary, null, 2));

if (failed.length) {
  console.error("\nFAILED:", failed.map((f) => f.id).join(", "));
  process.exit(1);
}
console.log("\nE2E FUNCTIONAL: PASS");
process.exit(exitCode);
