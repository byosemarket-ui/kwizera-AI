#!/usr/bin/env node
/**
 * Live Step 4 image preparation verification.
 * Confirms originals are preserved, preparation decisions work,
 * and video render receives a real playable asset path.
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
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep */ }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (error) {
    return { ok: false, status: 0, body: String(error) };
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
  console.log(`Live Step 4 image prep — ${BASE}`);
  const deploy = await json("GET", "/api/deployment");
  const sha = String(deploy.body?.deployedCommit ?? "");
  const requested = String(deploy.body?.requestedCommit ?? "");
  record(
    "deployed Step 4 commit",
    deploy.body?.verifiedLive === true
      && sha.length >= 40
      && requested === sha,
    sha.slice(0, 12) || "missing",
  );

  const stamp = `STEP4-IMG-${Date.now()}`;
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
        description: "Formal brown shoe for live image prep",
        price: 20000,
        currency: "RWF",
      },
      campaignInformation: { objective: "Product Showcase", callToAction: "Shop now", platforms: ["tiktok"] },
      language: "English",
      platform: "tiktok",
    },
  });

  const imageIds = [];
  for (let i = 0; i < 2; i += 1) {
    const up = await json("POST", `/api/workspace/projects/${projectId}/images`, {
      fileName: `oxford-${i + 1}.png`,
      mimeType: "image/png",
      dataBase64: productOnWhite(180, 180),
      width: 180,
      height: 180,
    });
    if (up.body?.image?.id) imageIds.push(up.body.image.id);
  }
  record("upload originals", imageIds.length === 2, imageIds.join(", "));

  const before = await json("GET", `/api/workspace/projects/${projectId}`);
  const originalChecksums = (before.body?.project?.productImages ?? [])
    .filter((img) => !img.parentAssetId)
    .map((img) => img.checksumSha256);

  const mediaPrepare = await json("POST", `/api/media-intelligence/projects/${projectId}/prepare`, {});
  record(
    "media intelligence prepare",
    mediaPrepare.ok || mediaPrepare.status === 200 || mediaPrepare.status === 201,
    String(mediaPrepare.status),
  );

  const report = await json("GET", `/api/media-intelligence/projects/${projectId}`);
  const reportBody = report.body?.report ?? report.body ?? {};
  const assets = reportBody.assets ?? [];
  record(
    "pipeline version step4-image-prep-v1",
    reportBody.pipelineVersion === "step4-image-prep-v1",
    String(reportBody.pipelineVersion ?? "missing"),
  );
  record("media report has assets", assets.length >= 1, String(assets.length));
  record(
    "originals marked preserved",
    assets.every((a) => a.originalPreserved === true),
    "",
  );
  record(
    "preparationDecision present",
    ["KEEP_ORIGINAL", "REMOVE_BACKGROUND", "REPLACE_BACKGROUND_LATER", "ENHANCE_SOURCE", "REFRAME_PRODUCT", "REQUEST_USER_ATTENTION"].includes(
      assets[0]?.preparationDecision,
    ),
    String(assets[0]?.preparationDecision ?? "missing"),
  );

  const after = await json("GET", `/api/workspace/projects/${projectId}`);
  const afterChecksums = (after.body?.project?.productImages ?? [])
    .filter((img) => !img.parentAssetId && imageIds.includes(img.id))
    .map((img) => img.checksumSha256);
  record(
    "original checksums unchanged",
    originalChecksums.length === afterChecksums.length
      && originalChecksums.every((hash, i) => hash === afterChecksums[i]),
    "",
  );

  const assetPrep = await json("POST", `/api/product-asset-preparation/projects/${projectId}/prepare`, {});
  const preparedCount = assetPrep.body?.result?.assets?.length
    ?? assetPrep.body?.assets?.length
    ?? 0;
  record("asset preparation ran", assetPrep.ok || assetPrep.status === 200 || assetPrep.status === 201, `prepared=${preparedCount}`);
  if (preparedCount > 0) {
    record(
      "prepared assets preserve originals flag",
      (assetPrep.body?.result?.assets ?? assetPrep.body?.assets ?? []).every((a) => a.originalPreserved),
      "",
    );
  }

  const plan = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "CLASSIC_SHOWCASE",
    regenerate: true,
    durationSeconds: 15,
  });
  record("creative plan generated", plan.ok && (plan.body?.plan?.scenes?.length ?? 0) > 0, String(plan.body?.plan?.scenes?.length ?? 0));
  record(
    "plan scenes use original asset ids",
    (plan.body?.plan?.scenes ?? []).every((s) => imageIds.includes(s.assetId)),
    "",
  );

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
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 4 image live checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
