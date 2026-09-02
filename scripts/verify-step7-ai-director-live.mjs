#!/usr/bin/env node
/**
 * Live Step 7 verification — AI Director, plan review, quality gate, full production.
 */
import { deflateSync } from "node:zlib";

const BASE = (process.argv[2] ?? "http://162.35.114.19:5173").replace(/\/$/, "");
const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  let crc = 0xffffffff;
  const crcInput = Buffer.concat([typeBuffer, data]);
  for (let i = 0; i < crcInput.length; i += 1) {
    crc ^= crcInput[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodeRgbaPng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function productOnWhite(width = 160, height = 160) {
  const rgba = Buffer.alloc(width * height * 4, 255);
  const left = Math.floor(width * 0.25);
  const right = Math.floor(width * 0.75);
  const top = Math.floor(height * 0.2);
  const bottom = Math.floor(height * 0.8);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = 120;
      rgba[i + 1] = 72;
      rgba[i + 2] = 40;
      rgba[i + 3] = 255;
    }
  }
  return encodeRgbaPng(width, height, rgba).toString("base64");
}

async function json(method, path, body, timeoutMs = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body != null ? { "Content-Type": "application/json" } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
    return { ok: res.ok, status: res.status, body: parsed };
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(fn, attempts = 120, delayMs = 3000) {
  for (let i = 0; i < attempts; i += 1) {
    const result = await fn();
    if (result === true) return true;
    if (result === "failed") return false;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function main() {
  console.log(`Live Step 7 AI Director — ${BASE}`);
  const deploy = await json("GET", "/api/deployment");
  record(
    "deployed commit verified",
    deploy.body?.verifiedLive === true && String(deploy.body?.deployedCommit ?? "").length >= 40,
    String(deploy.body?.deployedCommit ?? "").slice(0, 12),
  );

  const director = await json("GET", "/api/creative-director/status");
  const status = director.body?.status ?? {};
  record("creative director status", director.ok, status.creativeDirector?.mode ?? "");
  record(
    "director fallback or ai mode",
    ["ai", "deterministic-fallback"].includes(status.creativeDirector?.mode),
    String(status.creativeDirector?.mode ?? "missing"),
  );

  const diagnostics = await json("GET", "/api/ai-director/diagnostics");
  record("ai director diagnostics", diagnostics.ok, diagnostics.body?.diagnostics?.ollama?.status ?? "");
  record(
    "diagnostics include model info",
    Array.isArray(diagnostics.body?.diagnostics?.ollama?.installedModels),
    String(diagnostics.body?.diagnostics?.ollama?.installedModels?.length ?? 0),
  );

  const stamp = `STEP7-AI-${Date.now()}`;
  const created = await json("POST", "/api/workspace/projects", { name: stamp });
  const projectId = created.body?.project?.id;
  record("create project", Boolean(projectId), projectId ?? "");
  if (!projectId) process.exit(1);

  await json("POST", `/api/workspace/projects/${projectId}`, { action: "open" });
  await json("POST", `/api/workspace/projects/${projectId}`, {
    changes: {
      productInformation: {
        name: "Chestnut Oxford",
        category: "Shoes",
        description: "Formal brown oxford shoe",
        price: 45000,
        originalPrice: 60000,
        currency: "RWF",
      },
      campaignInformation: { objective: "Product Showcase", callToAction: "Shop now", platforms: ["tiktok"] },
      language: "English",
      platform: "tiktok",
      targetAudience: "Professionals 25-40",
    },
  });

  for (let i = 0; i < 2; i += 1) {
    await json("POST", `/api/workspace/projects/${projectId}/images`, {
      fileName: `oxford-${i + 1}.png`,
      mimeType: "image/png",
      dataBase64: productOnWhite(200, 200),
      width: 200,
      height: 200,
    });
  }

  await json("POST", `/api/media-intelligence/projects/${projectId}/prepare`, {});
  await json("POST", `/api/product-asset-preparation/projects/${projectId}/prepare`, {});

  const plan = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "AI_PRODUCT_MOTION",
    regenerate: true,
    durationSeconds: 15,
  });
  const planBody = plan.body?.plan ?? {};
  record("creative plan generated", plan.ok && (planBody.scenes?.length ?? 0) > 0, String(planBody.scenes?.length ?? 0));
  record(
    "plan source recorded",
    planBody.planSource === "ai" || planBody.planSource === "deterministic",
    String(planBody.planSource ?? "missing"),
  );
  record(
    "plan review items",
    (planBody.planReview?.length ?? 0) >= 1,
    String(planBody.planReview?.length ?? 0),
  );
  record(
    "decision trace bound to project",
    planBody.decisionTrace?.projectId === projectId,
    planBody.decisionTrace?.heroAssetId ?? "no-hero",
  );
  record(
    "decision trace has asset ids",
    (planBody.decisionTrace?.assetIds?.length ?? 0) >= 1,
    String(planBody.decisionTrace?.assetIds?.length ?? 0),
  );

  await json("POST", `/api/workspace/projects/${projectId}/plan/finalize`, {});

  const validation = await json("GET", `/api/video-production/projects/${projectId}/validate?preset=standard`);
  record("pre-render validation ready", validation.body?.validation?.ready === true, validation.body?.validation?.issues?.join("; ") ?? "");

  await json("POST", `/api/video-production/projects/${projectId}`, { action: "create" });
  const renderStart = await json("POST", `/api/video-production/projects/${projectId}/render`, { preset: "standard" });
  const jobId = renderStart.body?.job?.id;
  record("render started", Boolean(jobId), jobId ?? renderStart.body?.error ?? "");

  const done = await waitFor(async () => {
    const job = await json("GET", `/api/video-production/jobs/${jobId}`);
    if (job.body?.job?.status === "completed") return true;
    if (job.body?.job?.status === "failed") return "failed";
    return false;
  }, 120, 3000);
  record("render completed", done === true, renderStart.body?.job?.error ?? "");

  const video = await json("GET", `/api/video-production/projects/${projectId}`);
  const outputUrl = video.body?.video?.output?.url;
  record("output url present", Boolean(outputUrl), outputUrl ?? "");
  record(
    "technical validation passed",
    video.body?.video?.output?.validationStatus === "TECHNICALLY_VALIDATED",
    String(video.body?.video?.output?.validationStatus ?? "missing"),
  );
  record(
    "quality gate ready",
    video.body?.video?.qualityGate === "READY",
    String(video.body?.video?.qualityGate ?? "missing"),
  );

  const outputDetails = await json("GET", `/api/video-production/projects/${projectId}/output`);
  record(
    "quality review present",
    typeof outputDetails.body?.output?.qualityReview?.score === "number",
    String(outputDetails.body?.output?.qualityReview?.score ?? "missing"),
  );
  record(
    "quality review non-blocking",
    outputDetails.body?.output?.qualityReview?.blocking === false,
    String(outputDetails.body?.output?.qualityReview?.blocking ?? "missing"),
  );

  if (outputUrl) {
    const get = await fetch(`${BASE}${outputUrl}`, { headers: { Range: "bytes=0-1" } });
    record("output playable", get.ok || get.status === 206, String(get.status));
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 7 live checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
