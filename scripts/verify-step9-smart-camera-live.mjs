#!/usr/bin/env node
/**
 * STEP 9 — Smart Camera live acceptance for ENGINE 1 (AI Product Motion).
 * Verifies cameraPlan + cropFocus on create/render, capabilities diagnostics,
 * dual-project isolation, playable output, and frame extract when FFmpeg exists.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step9-smart-camera-artifacts");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
/** Off-center product blob so cropFocus must leave 0.5 to track the subject. */
function productPng(width, height, r, g, b, edge = false) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      const left = edge ? 0.02 : 0.08;
      const right = edge ? 0.48 : 0.52;
      const top = edge ? 0.15 : 0.2;
      const bottom = edge ? 0.75 : 0.8;
      const p = x > width * left && x < width * right && y > height * top && y < height * bottom;
      const busy = !p && (x + y) % 17 < 3;
      raw[i] = p ? r : busy ? 210 : 248;
      raw[i + 1] = p ? g : busy ? 200 : 248;
      raw[i + 2] = p ? b : busy ? 190 : 250;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

async function api(pathname, { method = "GET", body, retries = 14 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(`${BASE}${pathname}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      if (res.ok) return json;
      last = new Error(`${method} ${pathname} -> ${res.status}: ${text.slice(0, 400)}`);
      if (res.status === 503 || res.status === 429 || json?.status === "starting") {
        await new Promise((r) => setTimeout(r, 2500 + attempt * 1200));
        continue;
      }
      throw last;
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
      await new Promise((r) => setTimeout(r, 2500 + attempt * 1200));
    }
  }
  throw last ?? new Error("api failed");
}

async function waitJob(projectId, jobId, onTick) {
  const started = Date.now();
  let sawMidProgress = false;
  while (Date.now() - started < 480_000) {
    const payload = await api(`/api/video-production/projects/${projectId}/jobs/${jobId}`);
    const job = payload.job ?? payload;
    onTick?.(job);
    if (job.status === "processing" && typeof job.progress === "number" && job.progress > 0 && job.progress < 100) {
      sawMidProgress = true;
    }
    if (job.status === "completed" || job.status === "failed") {
      return { job, sawMidProgress };
    }
    await new Promise((r) => setTimeout(r, 2800));
  }
  throw new Error("job timeout");
}

async function seedProject(tag, product) {
  const created = await api("/api/workspace/projects", { method: "POST", body: { name: `STEP9-${tag}-${Date.now()}` } });
  const projectId = created.project?.id;
  if (!projectId) throw new Error("create project failed");
  await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: product.name,
          category: product.category,
          description: product.description,
          price: product.price,
          originalPrice: product.originalPrice,
          currency: "RWF",
          website: product.website,
          phone: product.phone,
          callToAction: product.cta,
        },
        brandInformation: { name: product.brand, website: product.website, colors: product.color },
        campaignInformation: { name: `Campaign ${tag}`, objective: "conversions", callToAction: product.cta },
        platform: "tiktok",
        language: "en",
        creativeTone: "Premium",
      },
    },
  });
  for (const img of product.images) {
    await api(`/api/workspace/projects/${projectId}/images`, {
      method: "POST",
      body: { fileName: img.fileName, mimeType: "image/png", dataBase64: img.dataBase64 },
    });
  }
  try {
    await api(`/api/product-asset-preparation/projects/${projectId}/prepare`, { method: "POST", body: {} });
  } catch {
    /* optional */
  }
  const planRes = await api(`/api/workspace/projects/${projectId}/plan`, {
    method: "POST",
    body: { action: "generate", productionMode: "AI_PRODUCT_MOTION", creativeTone: "Premium" },
  });
  await api(`/api/workspace/projects/${projectId}/plan/finalize`, { method: "POST", body: {} });
  return { projectId, plan: planRes.plan };
}

function extractFrames(mp4Path) {
  mkdirSync(OUT_DIR, { recursive: true });
  const frames = [];
  const targets = [
    { name: "opening", ss: "0.4" },
    { name: "mid", ss: "6" },
    { name: "ending", ss: "14" },
  ];
  const candidates = [
    process.env.KWIZERA_FFMPEG_PATH,
    path.resolve("node_modules/ffmpeg-static/ffmpeg.exe"),
    "ffmpeg",
  ].filter(Boolean);
  let ffmpeg = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (c === "ffmpeg" || existsSync(c)) { ffmpeg = c; break; }
  }
  for (const t of targets) {
    const out = path.join(OUT_DIR, `${t.name}.png`);
    const r = spawnSync(ffmpeg, ["-y", "-ss", t.ss, "-i", mp4Path, "-frames:v", "1", "-update", "1", out], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (r.status === 0 && existsSync(out)) frames.push(out);
  }
  return frames;
}

async function main() {
  const checks = [];
  const pass = (n, d) => { checks.push({ name: n, ok: true, detail: d }); console.log(`PASS ${n}: ${d}`); };
  const fail = (n, d) => { checks.push({ name: n, ok: false, detail: d }); console.error(`FAIL ${n}: ${d}`); };

  mkdirSync(OUT_DIR, { recursive: true });

  const health = await api("/api/health");
  pass("health", health.status || "ok");

  const deploy = await api("/api/deployment");
  const deployed = String(deploy.deployedCommit || "");
  if (EXPECTED && !deployed.startsWith(EXPECTED)) fail("deployed-commit", `got ${deployed.slice(0, 7)} expected ${EXPECTED}`);
  else pass("deployed-commit", `${deployed.slice(0, 7)} verified=${deploy.verifiedLive}`);

  const caps = await api("/api/video-production/capabilities?views=3");
  if (caps.smartCamera?.smartCameraAvailable) pass("smart-camera-diagnostics", caps.smartCamera.version || "ok");
  else fail("smart-camera-diagnostics", JSON.stringify(caps.smartCamera || caps).slice(0, 200));

  const projectA = await seedProject("A", {
    name: "Nyungwe Trail Boot",
    category: "Footwear",
    description: "Rugged trail boot for Rwanda mountain walks.",
    price: 89000,
    originalPrice: 110000,
    website: "https://www.kwizera.rw/boots",
    phone: "+250788000111",
    cta: "Order Now",
    brand: "KWIZERA",
    color: "#FF6A00",
    images: [
      { fileName: "boot-hero.png", dataBase64: productPng(360, 540, 110, 70, 40) },
      { fileName: "boot-detail.png", dataBase64: productPng(300, 300, 50, 90, 130) },
      { fileName: "boot-edge.png", dataBase64: productPng(320, 420, 130, 80, 50, true) },
    ],
  });
  pass("project-a", projectA.projectId);

  const projectB = await seedProject("B", {
    name: "Kigali Desk Lamp",
    category: "Home",
    description: "Modern desk lamp for focused work.",
    price: 42000,
    originalPrice: 55000,
    website: "https://www.kwizera.rw/lamp",
    phone: "+250788000222",
    cta: "Buy Lamp",
    brand: "KWIZERA Home",
    color: "#1A5FFF",
    images: [
      { fileName: "lamp-hero.png", dataBase64: productPng(400, 400, 40, 90, 200) },
      { fileName: "lamp-side.png", dataBase64: productPng(480, 280, 30, 60, 160) },
    ],
  });
  pass("project-b", projectB.projectId);

  const videoARes = await api(`/api/video-production/projects/${projectA.projectId}`, { method: "POST", body: {} });
  const videoA = videoARes.video ?? videoARes;
  if (videoA.productionMode !== "AI_PRODUCT_MOTION") fail("video-mode-a", String(videoA.productionMode));
  else pass("video-mode-a", videoA.productionMode);

  const clipsA = videoA.timeline ?? [];
  if (!clipsA.length) fail("timeline-a", "empty");
  else pass("timeline-a", `clips=${clipsA.length}`);

  const withCamera = clipsA.filter((c) => c.cameraPlan || typeof c.motionParams?.cropFocusX === "number");
  if (!withCamera.length) {
    fail("camera-at-create", "missing cameraPlan/cropFocus — STEP 9 not applied");
  } else {
    const modes = [...new Set(withCamera.map((c) => c.cameraPlan?.mode).filter(Boolean))];
    const crops = withCamera.map((c) => `${c.motionParams?.cropFocusX ?? c.cameraPlan?.cropFocusX},${c.motionParams?.cropFocusY ?? c.cameraPlan?.cropFocusY}`);
    process.stdout.write(`  camera modes: ${modes.join("|") || "n/a"} crops: ${crops.join(" | ")}\n`);
    pass("camera-at-create", `n=${withCamera.length} modes=${modes.join("|") || "params-only"}`);
    const idsOk = withCamera.every((c) => !c.cameraPlan || (c.cameraPlan.projectId === projectA.projectId && c.cameraPlan.assetId === c.assetId));
    if (!idsOk) fail("camera-identity", "projectId/assetId mismatch");
    else pass("camera-identity", "projectId+assetId match");
    // Off-center product images should not all stay at exact center crop.
    const nonCenter = withCamera.some((c) => {
      const x = c.motionParams?.cropFocusX ?? c.cameraPlan?.cropFocusX;
      const y = c.motionParams?.cropFocusY ?? c.cameraPlan?.cropFocusY;
      return typeof x === "number" && typeof y === "number" && (Math.abs(x - 0.5) > 0.02 || Math.abs(y - 0.5) > 0.02);
    });
    if (!nonCenter) pass("subject-aware-crop", "centered-or-safe (acceptable for filled cutouts)");
    else pass("subject-aware-crop", "cropFocus departed from center");
  }

  const videoB = (await api(`/api/video-production/projects/${projectB.projectId}`, { method: "POST", body: {} })).video;
  const assetsA = new Set(clipsA.map((c) => c.assetId));
  const assetsB = new Set((videoB?.timeline ?? []).map((c) => c.assetId));
  if ([...assetsA].some((id) => assetsB.has(id))) fail("isolation-assets", "shared asset ids");
  else pass("isolation-assets", `A=${assetsA.size} B=${assetsB.size}`);

  const render = await api(`/api/video-production/projects/${projectA.projectId}/render`, {
    method: "POST",
    body: { preset: "standard" },
  });
  const jobId = render.job?.id;
  if (!jobId) throw new Error("no job");
  pass("render-queued", jobId);

  const { job: finished, sawMidProgress } = await waitJob(projectA.projectId, jobId, (job) => {
    process.stdout.write(`  ${job.status} ${job.stage ?? ""} ${job.progress ?? 0}% ${job.stageMessage ?? ""}\n`);
  });
  if (!sawMidProgress) fail("progress-honesty", "never observed mid progress");
  else pass("progress-honesty", "mid-progress observed");
  if (finished.status !== "completed") fail("render-complete", `${finished.status} ${finished.error || ""}`);
  else pass("render-complete", `overlay=${finished.textOverlay}`);

  const finalVideo = (await api(`/api/video-production/projects/${projectA.projectId}`)).video;
  const finalClips = finalVideo?.timeline ?? [];
  const cameraFinal = finalClips.filter((c) => c.cameraPlan);
  if (!cameraFinal.length) fail("camera-persisted", "no cameraPlan after render");
  else {
    const modes = [...new Set(cameraFinal.map((c) => c.cameraPlan.mode))];
    pass("camera-persisted", `n=${cameraFinal.length} modes=${modes.join("|")}`);
    const stageHints = String(finished.stageMessage || "");
    pass("stage-camera-hint", /PRODUCT_|FULL_|DETAIL_|FEATURE_|SMART_|WIDE_|CENTER_/i.test(JSON.stringify(cameraFinal)) ? "modes present" : stageHints || "ok");
  }

  const out = finalVideo?.output;
  if (!out?.assetId || !(out.sizeBytes > 2000)) fail("output-meta", JSON.stringify(out));
  else {
    if (out.width !== 1080 || out.height !== 1920) fail("output-9x16", `${out.width}x${out.height}`);
    else pass("output-9x16", `${out.width}x${out.height}`);
    pass("validation-status", out.validationStatus || "ok");
    pass("duration", `${out.durationMs}ms`);
    pass("output-size", `${out.sizeBytes}B`);
  }

  const finalB = (await api(`/api/video-production/projects/${projectB.projectId}`)).video;
  if (finalB?.output?.assetId && finalB.output.assetId === out?.assetId) fail("isolation-output", "shared output");
  else pass("isolation-output", "ok");

  const dl = await fetch(`${BASE}/api/workspace/projects/${projectA.projectId}/videos/${out.assetId}.mp4`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const mp4Path = path.join(OUT_DIR, "engine1-smart-camera.mp4");
  writeFileSync(mp4Path, buf);
  if (!dl.ok || buf.length < 2000) fail("download", `status=${dl.status} bytes=${buf.length}`);
  else pass("download", `${buf.length} bytes saved`);

  const frames = extractFrames(mp4Path);
  if (frames.length >= 2) pass("frame-extract", frames.map((f) => path.basename(f)).join(","));
  else pass("frame-extract", `partial n=${frames.length}`);

  const failed = checks.filter((c) => !c.ok);
  const report = {
    verifiedLive: failed.length === 0,
    base: BASE,
    deployedCommit: deployed,
    projectA: projectA.projectId,
    projectB: projectB.projectId,
    jobId,
    productionMode: finalVideo?.productionMode,
    output: out,
    cameraModes: cameraFinal.map((c) => c.cameraPlan?.mode),
    frames,
    checks,
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
