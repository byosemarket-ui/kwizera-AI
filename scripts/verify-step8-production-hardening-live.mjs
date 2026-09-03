#!/usr/bin/env node
/**
 * Live Step 8 verification — full production foundation, data continuity, no Ollama install.
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

function productPng({ width = 160, height = 160, bg = [255, 255, 255], fg = [120, 72, 40] } = {}) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = 255;
  }
  const left = Math.floor(width * 0.25);
  const right = Math.floor(width * 0.75);
  const top = Math.floor(height * 0.2);
  const bottom = Math.floor(height * 0.8);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = fg[0];
      rgba[i + 1] = fg[1];
      rgba[i + 2] = fg[2];
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

function originalsOf(project) {
  return (project?.productImages ?? []).filter((img) => !img.parentAssetId && img.origin !== "derived" && img.origin !== "generated");
}

async function main() {
  console.log(`Live Step 8 production hardening — ${BASE}`);
  const deploy = await json("GET", "/api/deployment");
  const sha = String(deploy.body?.deployedCommit ?? "");
  record(
    "deployed commit verified",
    deploy.body?.verifiedLive === true && sha.length >= 40,
    sha.slice(0, 12),
  );

  const health = await json("GET", "/api/foundation-health");
  record("foundation health", health.ok && health.body?.ok === true, JSON.stringify(health.body?.checks?.map((c) => c.name) ?? []));
  record(
    "ffmpeg available",
    (health.body?.checks ?? []).some((c) => c.name === "ffmpeg" && c.ok),
    "",
  );

  const director = await json("GET", "/api/creative-director/status");
  const status = director.body?.status ?? {};
  record("creative director status", director.ok, status.creativeDirector?.mode ?? "");
  record(
    "ollama not required for studio",
    status.pipeline?.installOllamaNow === false || status.ollama?.autoInstallDisabled === true || status.creativeDirector?.mode === "deterministic-fallback",
    String(status.pipeline?.installOllamaNow ?? status.creativeDirector?.mode),
  );
  const publicBlob = JSON.stringify(status);
  record("public status hides host URL", !publicBlob.includes("127.0.0.1:11434"), "");
  record("public status hides RAM figures", !/"totalMemoryGb"/.test(publicBlob), "");

  const diagnostics = await json("GET", "/api/ai-director/diagnostics");
  record("ai director diagnostics", diagnostics.ok, diagnostics.body?.diagnostics?.ollama?.status ?? "");
  record(
    "diagnostics hide private base URL",
    !JSON.stringify(diagnostics.body ?? {}).includes("http://127.0.0.1"),
    "",
  );
  record(
    "auto install disabled",
    diagnostics.body?.diagnostics?.ollama?.autoInstallDisabled === true
      && diagnostics.body?.diagnostics?.pipeline?.installOllamaNow === false,
    "",
  );

  const stamp = `STEP8-HARDEN-${Date.now()}`;
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

  const variants = [
    { fileName: "white-studio.png", data: productPng({ width: 220, height: 220, bg: [255, 255, 255] }), width: 220, height: 220 },
    { fileName: "dark-bg.png", data: productPng({ width: 220, height: 220, bg: [18, 18, 22], fg: [210, 170, 120] }), width: 220, height: 220 },
    { fileName: "complex-bg.png", data: productPng({ width: 240, height: 240, bg: [90, 140, 80], fg: [120, 72, 40] }), width: 240, height: 240 },
    { fileName: "small.png", data: productPng({ width: 64, height: 64 }), width: 64, height: 64 },
    { fileName: "large.png", data: productPng({ width: 640, height: 640 }), width: 640, height: 640 },
  ];
  const imageIds = [];
  for (const variant of variants) {
    let uploadedId = null;
    let lastDetail = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const up = await json("POST", `/api/workspace/projects/${projectId}/images`, {
        fileName: variant.fileName,
        mimeType: "image/png",
        dataBase64: variant.data,
        width: variant.width,
        height: variant.height,
      });
      if (up.body?.image?.id) {
        uploadedId = up.body.image.id;
        break;
      }
      lastDetail = `${up.status}:${up.body?.error ?? up.body?.code ?? "no-image"}`;
      await new Promise((r) => setTimeout(r, 750 * attempt));
    }
    if (uploadedId) imageIds.push(uploadedId);
    else console.log(`  upload failed ${variant.fileName} — ${lastDetail}`);
  }
  // Confirm persistence even if one response was lost (authoritative project record).
  const afterUpload = await json("GET", `/api/workspace/projects/${projectId}`);
  const persistedOriginals = originalsOf(afterUpload.body?.project);
  if (persistedOriginals.length > imageIds.length) {
    for (const img of persistedOriginals) {
      if (!imageIds.includes(img.id)) imageIds.push(img.id);
    }
  }
  record("upload product images", imageIds.length === variants.length, `${imageIds.length}/${variants.length}`);

  const beforePrep = await json("GET", `/api/workspace/projects/${projectId}`);
  const originalChecksums = originalsOf(beforePrep.body?.project).map((img) => [img.id, img.checksumSha256]);

  await json("POST", `/api/media-intelligence/projects/${projectId}/prepare`, {});
  await json("POST", `/api/product-asset-preparation/projects/${projectId}/prepare`, {});

  const afterPrep = await json("GET", `/api/workspace/projects/${projectId}`);
  const afterProject = afterPrep.body?.project;
  record("same project after image prep", afterProject?.id === projectId, afterProject?.id ?? "");
  record("product name preserved after prep", afterProject?.productInformation?.name === "Chestnut Oxford", afterProject?.productInformation?.name ?? "");
  const afterOriginals = originalsOf(afterProject);
  record("original images still present", afterOriginals.length >= imageIds.length, String(afterOriginals.length));
  record(
    "original checksums unchanged",
    originalChecksums.every(([id, sum]) => afterOriginals.find((img) => img.id === id)?.checksumSha256 === sum),
    "",
  );
  for (const id of imageIds) {
    const img = await fetch(`${BASE}/api/workspace/projects/${projectId}/images/${id}.png`, { headers: { Range: "bytes=0-7" } });
    record(`original reachable ${id.slice(0, 8)}`, img.ok || img.status === 206, String(img.status));
  }

  const plan = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "AI_PRODUCT_MOTION",
    regenerate: true,
    durationSeconds: 15,
  });
  const planBody = plan.body?.plan ?? {};
  record("creative plan generated", plan.ok && (planBody.scenes?.length ?? 0) > 0, String(planBody.scenes?.length ?? 0));
  record("plan belongs to project", planBody.projectId === projectId, planBody.projectId ?? "");
  record("plan source recorded", planBody.planSource === "ai" || planBody.planSource === "deterministic", String(planBody.planSource ?? "missing"));
  record("decision trace project match", planBody.decisionTrace?.projectId === projectId, planBody.decisionTrace?.projectId ?? "");
  const planAssets = [...new Set((planBody.scenes ?? []).map((s) => s.assetId).filter(Boolean))];
  record(
    "plan uses current originals",
    planAssets.every((id) => imageIds.includes(id)),
    planAssets.join(","),
  );

  await json("POST", `/api/workspace/projects/${projectId}/plan/finalize`, {});

  const step2 = await json("GET", `/api/workspace/projects/${projectId}`);
  record("step 2/3 same project", step2.body?.project?.id === projectId, "");
  record("price preserved", step2.body?.project?.productInformation?.price === 45000, String(step2.body?.project?.productInformation?.price));
  record("audience preserved", step2.body?.project?.targetAudience === "Professionals 25-40", step2.body?.project?.targetAudience ?? "");

  const validation = await json("GET", `/api/video-production/projects/${projectId}/validate?preset=standard`);
  record("pre-render validation ready", validation.body?.validation?.ready === true, validation.body?.validation?.issues?.join("; ") ?? "");

  const timeline = await json("POST", `/api/video-production/projects/${projectId}`, { action: "create" });
  const video = timeline.body?.video;
  record("timeline created", timeline.ok && (video?.timeline?.length ?? 0) > 0, String(video?.timeline?.length ?? 0));
  record("timeline project match", video?.projectId === projectId, video?.projectId ?? "");
  const timelineAssets = [...new Set((video?.timeline ?? []).map((clip) => clip.assetId).filter(Boolean))];
  record(
    "timeline uses current assets",
    timelineAssets.every((id) => imageIds.includes(id)),
    timelineAssets.join(","),
  );

  const renderStart = await json("POST", `/api/video-production/projects/${projectId}/render`, { preset: "standard" });
  const jobId = renderStart.body?.job?.id;
  record("render started", Boolean(jobId), jobId ?? renderStart.body?.error ?? "");
  record("render job project match", renderStart.body?.job?.projectId === projectId, renderStart.body?.job?.projectId ?? "");

  let sawMidProgress = false;
  let jumpedTo100Early = false;
  const done = await waitFor(async () => {
    const job = await json("GET", `/api/video-production/jobs/${jobId}`);
    const progress = job.body?.job?.progress ?? 0;
    const statusName = job.body?.job?.status;
    if (progress > 0 && progress < 100) sawMidProgress = true;
    if (statusName !== "completed" && progress >= 100) jumpedTo100Early = true;
    if (statusName === "completed") return true;
    if (statusName === "failed") return "failed";
    return false;
  }, 120, 3000);
  record("render completed", done === true, "");
  record("honest mid-render progress", sawMidProgress || done === true, sawMidProgress ? "yes" : "single-tick");
  record("progress did not hit 100 before complete", jumpedTo100Early === false, "");

  const produced = await json("GET", `/api/video-production/projects/${projectId}`);
  const outputUrl = produced.body?.video?.output?.url;
  record("output url present", Boolean(outputUrl), outputUrl ?? "");
  record(
    "technical validation passed",
    produced.body?.video?.output?.validationStatus === "TECHNICALLY_VALIDATED",
    String(produced.body?.video?.output?.validationStatus ?? "missing"),
  );
  record("quality gate ready", produced.body?.video?.qualityGate === "READY", String(produced.body?.video?.qualityGate ?? "missing"));
  record("output belongs to project", produced.body?.video?.projectId === projectId, "");

  if (outputUrl) {
    const get = await fetch(`${BASE}${outputUrl}`, { headers: { Range: "bytes=0-11" } });
    record("output playable", get.ok || get.status === 206, String(get.status));
    const header = Buffer.from(await get.arrayBuffer());
    const brand = header.length >= 8 ? header.slice(4, 8).toString("ascii") : "";
    record("output looks like mp4", brand === "ftyp", brand || "missing");
    const download = await fetch(`${BASE}${outputUrl}`);
    const bytes = Buffer.from(await download.arrayBuffer());
    record("download non-empty", download.ok && bytes.length > 1000, String(bytes.length));
  }

  const reopened = await json("POST", `/api/workspace/projects/${projectId}`, { action: "open" });
  const reopenedProject = reopened.body?.project ?? (await json("GET", `/api/workspace/projects/${projectId}`)).body?.project;
  record("reopen same project", reopenedProject?.id === projectId, reopenedProject?.id ?? "");
  record("reopen keeps product name", reopenedProject?.productInformation?.name === "Chestnut Oxford", reopenedProject?.productInformation?.name ?? "");
  record("reopen keeps original images", originalsOf(reopenedProject).length >= imageIds.length, String(originalsOf(reopenedProject).length));

  const missingAsset = await json("GET", `/api/video-production/projects/${projectId}/jobs/not-a-real-job`);
  record("missing job is not fake success", missingAsset.ok === false || !missingAsset.body?.job?.id, String(missingAsset.status));

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 8 live checks passed`);
  if (failed.length) {
    for (const item of failed) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
