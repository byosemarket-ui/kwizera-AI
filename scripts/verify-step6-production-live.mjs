#!/usr/bin/env node
/**
 * Live Step 6 verification — full production pipeline on production VPS.
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
  console.log(`Live Step 6 production — ${BASE}`);
  const deploy = await json("GET", "/api/deployment");
  record(
    "deployed commit verified",
    deploy.body?.verifiedLive === true && String(deploy.body?.deployedCommit ?? "").length >= 40,
    String(deploy.body?.deployedCommit ?? "").slice(0, 12),
  );

  const stamp = `STEP6-PROD-${Date.now()}`;
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

  const imageIds = [];
  for (let i = 0; i < 2; i += 1) {
    const up = await json("POST", `/api/workspace/projects/${projectId}/images`, {
      fileName: `oxford-${i + 1}.png`,
      mimeType: "image/png",
      dataBase64: productOnWhite(200, 200),
      width: 200,
      height: 200,
    });
    if (up.body?.image?.id) imageIds.push(up.body.image.id);
  }
  record("upload product images", imageIds.length === 2, imageIds.join(", "));

  await json("POST", `/api/media-intelligence/projects/${projectId}/prepare`, {});
  await json("POST", `/api/product-asset-preparation/projects/${projectId}/prepare`, {});

  const plan = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "AI_PRODUCT_MOTION",
    regenerate: true,
    durationSeconds: 15,
  });
  record("creative plan generated", plan.ok && (plan.body?.plan?.scenes?.length ?? 0) > 0, String(plan.body?.plan?.scenes?.length ?? 0));
  await json("POST", `/api/workspace/projects/${projectId}/plan/finalize`, {});

  const validation = await json("GET", `/api/video-production/projects/${projectId}/validate?preset=standard`);
  record("pre-render validation ready", validation.body?.validation?.ready === true, validation.body?.validation?.issues?.join("; ") ?? "");

  const timeline = await json("POST", `/api/video-production/projects/${projectId}`, { action: "create" });
  record("timeline created", timeline.ok && (timeline.body?.video?.timeline?.length ?? 0) > 0, String(timeline.body?.video?.timeline?.length ?? 0));
  record(
    "production mode persisted",
    timeline.body?.video?.productionMode === "AI_PRODUCT_MOTION",
    String(timeline.body?.video?.productionMode ?? "missing"),
  );

  const renderStart = await json("POST", `/api/video-production/projects/${projectId}/render`, { preset: "standard" });
  const jobId = renderStart.body?.job?.id;
  record("standard render started", Boolean(jobId), jobId ?? renderStart.body?.error ?? "");

  let lastProgress = 0;
  let sceneProgressSeen = false;
  const done = await waitFor(async () => {
    const job = await json("GET", `/api/video-production/jobs/${jobId}`);
    const progress = job.body?.job?.progress ?? 0;
    if (progress > lastProgress) lastProgress = progress;
    if (job.body?.job?.sceneIndex && job.body?.job?.sceneCount) sceneProgressSeen = true;
    if (job.body?.job?.status === "completed") return true;
    if (job.body?.job?.status === "failed") return "failed";
    return false;
  }, 120, 3000);
  record("render completed", done === true, renderStart.body?.job?.error ?? "");
  record("progress advanced", lastProgress >= 80, String(lastProgress));
  record("scene progress reported", sceneProgressSeen, sceneProgressSeen ? "yes" : "optional");

  const video = await json("GET", `/api/video-production/projects/${projectId}`);
  const outputUrl = video.body?.video?.output?.url;
  record("output url present", Boolean(outputUrl), outputUrl ?? "");
  record(
    "output technically validated",
    video.body?.video?.output?.validationStatus === "TECHNICALLY_VALIDATED",
    String(video.body?.video?.output?.validationStatus ?? "missing"),
  );

  if (outputUrl) {
    const head = await fetch(`${BASE}${outputUrl}`, { method: "HEAD" }).catch(() => null);
    const get = await fetch(`${BASE}${outputUrl}`, { headers: { Range: "bytes=0-1" } });
    record("output HEAD reachable", Boolean(head?.ok), String(head?.status ?? "n/a"));
    record("output GET playable", get.ok || get.status === 206, String(get.status));
    const type = get.headers.get("content-type") ?? head?.headers.get("content-type") ?? "";
    record("output video mime", /video\/mp4|application\/octet-stream/i.test(type), type || "missing");
  }

  const versions = await json("GET", `/api/video-production/projects/${projectId}/versions`);
  record("version history present", (versions.body?.versions?.length ?? 0) >= 1, String(versions.body?.versions?.length ?? 0));

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 6 live checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
