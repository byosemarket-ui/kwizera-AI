#!/usr/bin/env node
/**
 * Live Step 10 verification — real inference through existing KWIZERA provider APIs.
 * Does not call Ollama directly and does not install models.
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

function originalsOf(project) {
  return (project?.productImages ?? []).filter((img) => !img.parentAssetId && img.origin !== "derived" && img.mimeType !== "video/mp4");
}

async function json(method, path, body, timeoutMs = 300000) {
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

async function getProject(projectId) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await json("GET", `/api/workspace/projects/${projectId}`);
    if (res.body?.project?.id) return res.body.project;
    const opened = await json("POST", `/api/workspace/projects/${projectId}`, { action: "open" });
    if (opened.body?.project?.id) return opened.body.project;
    await new Promise((r) => setTimeout(r, 750 * attempt));
  }
  return null;
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

async function createFilledProject(stamp) {
  const created = await json("POST", "/api/workspace/projects", { name: stamp });
  const projectId = created.body?.project?.id;
  if (!projectId) return { projectId: null };
  await json("POST", `/api/workspace/projects/${projectId}`, { action: "open" });
  const updated = await json("POST", `/api/workspace/projects/${projectId}`, {
    changes: {
      productInformation: {
        name: stamp.includes("B") ? "Walnut Loafer" : "Chestnut Oxford",
        category: "Shoes",
        description: stamp.includes("B") ? "Casual walnut loafer" : "Formal brown oxford shoe",
        price: stamp.includes("B") ? 28000 : 45000,
        originalPrice: stamp.includes("B") ? 35000 : 60000,
        currency: "RWF",
      },
      campaignInformation: { objective: "Product Showcase", callToAction: "Shop now", platforms: ["tiktok"] },
      language: "English",
      platform: "tiktok",
      targetAudience: stamp.includes("B") ? "Students 18-25" : "Professionals 25-40",
    },
  });
  const up = await json("POST", `/api/workspace/projects/${projectId}/images`, {
    fileName: stamp.includes("B") ? "loafer.png" : "oxford.png",
    mimeType: "image/png",
    dataBase64: productPng(stamp.includes("B")
      ? { width: 180, height: 180, bg: [40, 40, 48], fg: [180, 140, 90] }
      : { width: 220, height: 220 }),
    width: stamp.includes("B") ? 180 : 220,
    height: stamp.includes("B") ? 180 : 220,
  });
  return {
    projectId,
    imageId: up.body?.image?.id,
    project: up.body?.project ?? updated.body?.project,
  };
}

async function main() {
  console.log(`Live Step 10 Ollama intelligence — ${BASE}`);
  const deployment = await json("GET", "/api/deployment");
  record("deployment live", deployment.ok && deployment.body?.status === "live", deployment.body?.deployedCommit?.slice(0, 12) ?? "");

  const status = await json("GET", "/api/creative-director/status");
  const statusBody = status.body?.status ?? status.body;
  record("creative director available", statusBody?.creativeDirector?.available === true, statusBody?.creativeDirector?.providerId ?? "");
  record("mode is ai", statusBody?.creativeDirector?.mode === "ai", statusBody?.creativeDirector?.mode ?? "");
  record("selected model llama3.2:1b", /llama3\.2:1b/i.test(String(statusBody?.creativeDirector?.modelId ?? statusBody?.ollama?.selectedModel ?? "")), String(statusBody?.creativeDirector?.modelId ?? ""));

  const diagnostics = await json("GET", "/api/ai-director/diagnostics");
  const diag = diagnostics.body?.diagnostics ?? diagnostics.body;
  record("ollama ready", diag?.ollama?.status === "READY", diag?.ollama?.status ?? "");
  record("diagnostics hide localhost URL", !JSON.stringify(diag ?? {}).includes("127.0.0.1:11434"), "");

  const a = await createFilledProject(`STEP10-A-${Date.now()}`);
  record("project A created", Boolean(a.projectId), a.projectId ?? "");
  if (!a.projectId) process.exit(1);

  record("step1 product name", a.project?.productInformation?.name === "Chestnut Oxford", a.project?.productInformation?.name ?? "");
  record("step1 price", a.project?.productInformation?.price === 45000, String(a.project?.productInformation?.price));
  record("step1 previous price", a.project?.productInformation?.originalPrice === 60000, String(a.project?.productInformation?.originalPrice));
  record("step1 image", Boolean(a.imageId) || originalsOf(a.project).length >= 1, a.imageId ?? String(originalsOf(a.project).length));

  // Retry plan once if gateway/worker returns 503 during long inference.
  let planA = await json("POST", `/api/workspace/projects/${a.projectId}/plan`, {
    action: "generate",
    productionMode: "AI_PRODUCT_MOTION",
    regenerate: true,
    durationSeconds: 15,
  }, 300000);
  if (planA.status === 503 || !planA.body?.plan) {
    await new Promise((r) => setTimeout(r, 5000));
    planA = await json("POST", `/api/workspace/projects/${a.projectId}/plan`, {
      action: "generate",
      productionMode: "AI_PRODUCT_MOTION",
      regenerate: true,
      durationSeconds: 15,
    }, 300000);
  }
  const planBody = planA.body?.plan ?? {};
  record("real plan generated via existing API", planA.ok && (planBody.scenes?.length ?? 0) > 0, `${planA.status}:${planBody.planSource ?? ""}`);
  record("plan A project identity", planBody.projectId === a.projectId, planBody.projectId ?? "");
  record("real Ollama inference used", planBody.planSource === "ai", `${planBody.planSource ?? "missing"}; warnings=${(planBody.planWarnings ?? []).join(" | ")}`);
  record("model recorded", /llama3\.2:1b/i.test(String(planBody.aiModelId ?? planBody.decisionTrace?.modelId ?? "")), String(planBody.aiModelId ?? planBody.decisionTrace?.modelId ?? ""));
  const planAssets = [...new Set((planBody.scenes ?? []).map((s) => s.assetId).filter(Boolean))];
  record("plan assets belong to A", planAssets.every((id) => id === a.imageId || originalsOf(a.project).some((img) => img.id === id)), planAssets.join(","));

  const reopen = await getProject(a.projectId);
  record("existing project reopen", reopen?.id === a.projectId, reopen?.id ?? "");
  record("audience persisted", reopen?.targetAudience === "Professionals 25-40", reopen?.targetAudience ?? "");
  record("price persisted on reopen", reopen?.productInformation?.price === 45000, String(reopen?.productInformation?.price));

  const b = await createFilledProject(`STEP10-B-${Date.now()}`);
  record("project B created", Boolean(b.projectId) && b.projectId !== a.projectId, b.projectId ?? "");
  await new Promise((r) => setTimeout(r, 3000));
  let planB = await json("POST", `/api/workspace/projects/${b.projectId}/plan`, {
    action: "generate",
    productionMode: "CLASSIC_SHOWCASE",
    regenerate: true,
    durationSeconds: 12,
  }, 300000);
  if (planB.status === 503 || !planB.body?.plan) {
    await new Promise((r) => setTimeout(r, 5000));
    planB = await json("POST", `/api/workspace/projects/${b.projectId}/plan`, {
      action: "generate",
      productionMode: "CLASSIC_SHOWCASE",
      regenerate: true,
      durationSeconds: 12,
    }, 300000);
  }
  const planBBody = planB.body?.plan ?? {};
  record("project B isolation", planBBody.projectId === b.projectId && planBBody.projectId !== a.projectId, `${planB.status}:${planBBody.projectId ?? ""}:${planBBody.planSource ?? ""}`);
  record("project B does not use A image", !(planBBody.scenes ?? []).some((s) => s.assetId === a.imageId), "");

  await json("POST", `/api/workspace/projects/${a.projectId}/plan/finalize`, {});
  const validation = await json("GET", `/api/video-production/projects/${a.projectId}/validate?preset=standard`);
  record("pre-render validation", validation.body?.validation?.ready === true, validation.body?.validation?.issues?.join("; ") ?? "");
  const timeline = await json("POST", `/api/video-production/projects/${a.projectId}`, { action: "create" });
  record("timeline same project", timeline.body?.video?.projectId === a.projectId, timeline.body?.video?.projectId ?? "");

  const renderStart = await json("POST", `/api/video-production/projects/${a.projectId}/render`, { preset: "standard" });
  const jobId = renderStart.body?.job?.id;
  record("render started", Boolean(jobId), jobId ?? renderStart.body?.error ?? "");
  let jumpedTo100Early = false;
  const done = await waitFor(async () => {
    const job = await json("GET", `/api/video-production/jobs/${jobId}`);
    const progress = job.body?.job?.progress ?? 0;
    const statusName = job.body?.job?.status;
    if (statusName !== "completed" && progress >= 100) jumpedTo100Early = true;
    if (statusName === "completed") return true;
    if (statusName === "failed") return "failed";
    return false;
  });
  record("render completed", done === true, "");
  record("no false 100 before complete", jumpedTo100Early === false, "");

  const produced = await json("GET", `/api/video-production/projects/${a.projectId}`);
  const outputUrl = produced.body?.video?.output?.url;
  record("output url", Boolean(outputUrl), outputUrl ?? "");
  record("quality gate ready", produced.body?.video?.qualityGate === "READY", String(produced.body?.video?.qualityGate ?? ""));
  if (outputUrl) {
    const video = await fetch(`${BASE}${outputUrl}`, { headers: { Range: "bytes=0-11" } });
    const buf = Buffer.from(await video.arrayBuffer());
    record("output playable", video.ok || video.status === 206, String(video.status));
    record("output looks like mp4", buf.includes(Buffer.from("ftyp")), buf.slice(4, 8).toString());
    const download = await fetch(`${BASE}${outputUrl}`);
    const bytes = Buffer.from(await download.arrayBuffer());
    record("download non-empty", download.ok && bytes.length > 1000, String(bytes.length));
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 10 live checks passed`);
  for (const item of failed) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
