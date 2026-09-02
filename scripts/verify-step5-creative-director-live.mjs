#!/usr/bin/env node
/**
 * Live Step 5 verification — AI Creative Director + Ollama integration.
 * Honest about Ollama availability; verifies deterministic fallback still produces playable video.
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

async function json(method, path, body, timeoutMs = 120000) {
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

async function waitFor(fn, attempts = 90, delayMs = 2000) {
  for (let i = 0; i < attempts; i += 1) {
    const result = await fn();
    if (result === true) return true;
    if (result === "failed") return false;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function main() {
  console.log(`Live Step 5 Creative Director — ${BASE}`);
  const deploy = await json("GET", "/api/deployment");
  const sha = String(deploy.body?.deployedCommit ?? "");
  record(
    "deployed commit verified",
    deploy.body?.verifiedLive === true && sha.length >= 40,
    sha.slice(0, 12) || "missing",
  );

  const readiness = await json("GET", "/api/media-intelligence/ollama-readiness");
  const report = readiness.body?.readiness ?? {};
  record("ollama readiness endpoint", readiness.ok, report.status ?? String(readiness.status));
  record("ollama status reported", Boolean(report.status), String(report.status ?? "missing"));
  record("model strategy present", Boolean(report.modelStrategy?.tier), String(report.modelStrategy?.tier ?? "missing"));
  // Honest: this VPS may not have Ollama — that is OK if fallback works.
  if (report.ready) {
    record("ollama ready with model", Boolean(report.selectedModel), String(report.selectedModel));
  } else {
    record("ollama unavailable handled safely", report.ready === false, report.recommendedAction ?? "unknown");
  }

  const director = await json("GET", "/api/creative-director/status");
  const status = director.body?.status ?? {};
  record("creative director status endpoint", director.ok, status.creativeDirector?.mode ?? "");
  record(
    "director mode explicit",
    ["ai", "deterministic-fallback"].includes(status.creativeDirector?.mode),
    String(status.creativeDirector?.mode ?? "missing"),
  );
  record(
    "video generation provider honest",
    status.videoGenerationProvider?.status === "UNAVAILABLE"
      || status.videoGenerationProvider?.available === false,
    String(status.videoGenerationProvider?.status ?? "missing"),
  );

  const stamp = `STEP5-AI-${Date.now()}`;
  const created = await json("POST", "/api/workspace/projects", { name: stamp });
  const projectId = created.body?.project?.id;
  record("create project", Boolean(projectId), projectId ?? "");
  if (!projectId) process.exit(1);

  await json("POST", `/api/workspace/projects/${projectId}`, { action: "open" });
  await json("POST", `/api/workspace/projects/${projectId}`, {
    changes: {
      productInformation: {
        name: "Brown Oxford Shoe",
        category: "Shoes",
        description: "Formal brown shoe for Step 5 AI director",
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

  const up = await json("POST", `/api/workspace/projects/${projectId}/images`, {
    fileName: "oxford-front.png",
    mimeType: "image/png",
    dataBase64: productOnWhite(180, 180),
    width: 180,
    height: 180,
  });
  const assetId = up.body?.image?.id;
  record("upload product image", Boolean(assetId), assetId ?? "");

  await json("POST", `/api/media-intelligence/projects/${projectId}/prepare`, {});

  const plan = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "CLASSIC_SHOWCASE",
    regenerate: true,
    durationSeconds: 15,
  });
  const planBody = plan.body?.plan ?? {};
  record("creative plan generated", plan.ok && (planBody.scenes?.length ?? 0) > 0, String(planBody.scenes?.length ?? 0));
  record("plan bound to projectId", planBody.projectId === projectId, String(planBody.projectId ?? "missing"));
  record(
    "planSource persisted",
    planBody.planSource === "ai" || planBody.planSource === "deterministic",
    String(planBody.planSource ?? "missing"),
  );
  record(
    "plan respects CLASSIC_SHOWCASE",
    planBody.productionMode === "CLASSIC_SHOWCASE",
    String(planBody.productionMode ?? "missing"),
  );
  record(
    "scenes use real asset ids",
    (planBody.scenes ?? []).every((s) => !s.assetId || s.assetId === assetId),
    "",
  );

  // If Ollama is not ready, planSource must be deterministic (not fake AI success).
  if (!report.ready) {
    record(
      "no fake AI success when ollama unavailable",
      planBody.planSource === "deterministic",
      String(planBody.planSource),
    );
  }

  await json("POST", `/api/workspace/projects/${projectId}/plan/finalize`, {});
  const timeline = await json("POST", `/api/video-production/projects/${projectId}`, { action: "create" });
  record("video timeline created", timeline.ok && (timeline.body?.video?.timeline?.length ?? 0) > 0, "");

  const renderStart = await json("POST", `/api/video-production/projects/${projectId}/render`, { preset: "preview" });
  const jobId = renderStart.body?.job?.id;
  record("render started", Boolean(jobId), jobId ?? renderStart.body?.error ?? "");

  let renderError = "";
  const done = await waitFor(async () => {
    const job = await json("GET", `/api/video-production/jobs/${jobId}`);
    if (job.body?.job?.status === "completed") return true;
    if (job.body?.job?.status === "failed") {
      renderError = job.body?.job?.error ?? "failed";
      return "failed";
    }
    return false;
  }, 90, 3000);
  record("render completed", done === true, renderError);

  const video = await json("GET", `/api/video-production/projects/${projectId}`);
  const outputUrl = video.body?.video?.output?.url;
  record("output url present", Boolean(outputUrl), outputUrl ?? "");
  if (outputUrl) {
    const media = await fetch(`${BASE}${outputUrl}`, { method: "GET", headers: { Range: "bytes=0-1" } });
    record("output playable/reachable", media.ok || media.status === 206, String(media.status));
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 5 live checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
