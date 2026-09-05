#!/usr/bin/env node
/**
 * STEP 11 live acceptance — ENGINE 1 final render, end card, validation, playback, download.
 * Does not claim ENGINE 2/3 or full KWIZERA AI STUDIO completion.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step11-engine1-artifacts");

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
function productPng(width, height, r, g, b) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      const p = x > width * 0.2 && x < width * 0.8 && y > height * 0.18 && y < height * 0.82;
      raw[i] = p ? r : 245;
      raw[i + 1] = p ? g : 245;
      raw[i + 2] = p ? b : 248;
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

async function api(pathname, { method = "GET", body, retries = 16 } = {}) {
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
      if (res.ok || res.status === 202) return json ?? { ok: true, status: res.status };
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

async function seedProject(tag) {
  const created = await api("/api/workspace/projects", { method: "POST", body: { name: `STEP11-${tag}-${Date.now()}` } });
  const projectId = created.project?.id;
  if (!projectId) throw new Error("create project failed");
  await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: `Akagera ${tag} Pack`,
          category: "Outdoor",
          description: "Live STEP 11 ENGINE 1 final validation product.",
          price: 64000,
          originalPrice: 80000,
          currency: "RWF",
          website: "https://www.kwizera.rw/akagera",
          phone: "+250788333444",
          callToAction: "Shop Now",
        },
        brandInformation: { name: `Kwizera ${tag}`, website: "https://www.kwizera.rw", colors: "#102030" },
        campaignInformation: { name: `Campaign ${tag}`, objective: "conversions", callToAction: "Order Today" },
        platform: "tiktok",
        language: "en",
        creativeTone: "Premium",
      },
    },
  });
  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: {
      fileName: `${tag}-hero.png`,
      mimeType: "image/png",
      dataBase64: productPng(640, 960, 30 + tag.charCodeAt(0) % 40, 90, 140),
    },
  });
  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: {
      fileName: `${tag}-alt.png`,
      mimeType: "image/png",
      dataBase64: productPng(640, 960, 120, 70, 40),
    },
  });
  try {
    await api(`/api/product-asset-preparation/projects/${projectId}/prepare`, { method: "POST", body: {} });
  } catch { /* optional */ }
  await api(`/api/workspace/projects/${projectId}/plan`, {
    method: "POST",
    body: { action: "generate", productionMode: "AI_PRODUCT_MOTION", creativeTone: "Premium" },
  });
  await api(`/api/workspace/projects/${projectId}/plan/finalize`, { method: "POST", body: {} });
  return { projectId };
}

async function waitJob(projectId, jobId) {
  let last = null;
  for (let i = 0; i < 240; i++) {
    last = await api(`/api/video-production/projects/${projectId}/jobs/${jobId}`);
    const job = last.job ?? last;
    const progress = job.progress ?? 0;
    const stage = job.stage ?? job.status;
    console.log(`  ${job.status} ${stage} ${progress}% ${job.stageMessage || ""}`);
    if (job.status === "completed" || job.status === "failed") return job;
    if (progress >= 100 && job.status === "processing") {
      throw new Error("False ready: progress 100 while still processing");
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`job timeout: ${JSON.stringify(last).slice(0, 300)}`);
}

async function main() {
  const checks = [];
  const pass = (n, d) => { checks.push({ name: n, ok: true, detail: d }); console.log(`PASS ${n}: ${d}`); };
  const fail = (n, d) => { checks.push({ name: n, ok: false, detail: d }); console.error(`FAIL ${n}: ${d}`); };
  mkdirSync(OUT_DIR, { recursive: true });

  const health = await api("/api/health");
  if (health.runtimeReady === true && health.status === "healthy") pass("health", "healthy");
  else fail("health", JSON.stringify(health).slice(0, 200));

  const deploy = await api("/api/deployment");
  const deployed = String(deploy.deployedCommit || "");
  if (EXPECTED && !deployed.startsWith(EXPECTED)) fail("deployed-commit", `got ${deployed.slice(0, 7)} expected ${EXPECTED}`);
  else pass("deployed-commit", `${deployed.slice(0, 7)} verified=${deploy.verifiedLive}`);

  const caps = await api("/api/video-production/capabilities?views=3");
  if (caps.engine1Final?.engine1FinalAvailable) pass("engine1-final-diagnostics", caps.engine1Final.version || "ok");
  else fail("engine1-final-diagnostics", JSON.stringify(caps.engine1Final || {}).slice(0, 200));
  if (caps.engine1Final?.endCard?.companyDataDriven) pass("end-card-diagnostics", caps.engine1Final.endCard.version || "ok");
  else fail("end-card-diagnostics", "missing");
  if (caps.sceneComposition?.compositionEngineAvailable) pass("composition-still", caps.sceneComposition.version || "ok");
  else fail("composition-still", "missing");
  if (caps.smartCamera?.smartCameraAvailable) pass("smart-camera-still", caps.smartCamera.version || "ok");
  else fail("smart-camera-still", "missing");

  const { projectId } = await seedProject("LIVE");
  pass("project", projectId);
  const { projectId: projectB } = await seedProject("ISO");
  pass("project-b", projectB);

  await api(`/api/video-production/projects/${projectId}`, { method: "POST", body: { action: "create" } });
  const video = await api(`/api/video-production/projects/${projectId}`);
  const mode = video.video?.productionMode || video.productionMode;
  if (mode === "AI_PRODUCT_MOTION") pass("engine-mode", mode);
  else fail("engine-mode", String(mode));

  const started = await api(`/api/video-production/projects/${projectId}/render`, {
    method: "POST",
    body: { preset: "standard" },
  });
  const jobId = started.job?.id || started.id;
  if (!jobId) fail("render-queued", JSON.stringify(started).slice(0, 200));
  else pass("render-queued", jobId);

  const job = await waitJob(projectId, jobId);
  if (job.status !== "completed") fail("render-complete", `${job.status} ${job.error || ""}`);
  else pass("render-complete", `endCard=${job.endCardRendered} dur=${job.endCardDurationMs}`);

  if (job.endCardRendered !== true) fail("end-card-rendered", String(job.endCardRendered));
  else pass("end-card-rendered", `${job.endCardDurationMs}ms`);

  const out = await api(`/api/video-production/projects/${projectId}/output`);
  const output = out.output || out;
  if (!output?.url || !output?.assetId) fail("output-meta", JSON.stringify(out).slice(0, 200));
  else pass("output-meta", `${output.width}x${output.height} ${output.durationMs}ms ${output.sizeBytes}b`);

  if ((output.sizeBytes || 0) < 1000) fail("output-size", String(output.sizeBytes));
  else pass("output-size", String(output.sizeBytes));

  const videoUrl = output.url.startsWith("http") ? output.url : `${BASE}${output.url}`;
  const play = await fetch(videoUrl, { method: "GET" });
  const buf = Buffer.from(await play.arrayBuffer());
  if (!play.ok || buf.length < 1000) fail("playback", `${play.status} bytes=${buf.length}`);
  else {
    const head = buf.subarray(0, 12).toString("ascii");
    if (!head.includes("ftyp") && buf[4] !== 0x66) fail("playback-mp4", `head=${buf.subarray(0, 12).toString("hex")}`);
    else pass("playback", `${play.status} bytes=${buf.length} type=${play.headers.get("content-type")}`);
  }

  const dl = await fetch(videoUrl, { method: "GET", headers: { Accept: "video/mp4" } });
  const dlBuf = Buffer.from(await dl.arrayBuffer());
  if (!dl.ok || dlBuf.length < 1000) fail("download", `${dl.status} bytes=${dlBuf.length}`);
  else pass("download", `${dlBuf.length} bytes`);

  if (!String(output.url).includes(projectId)) fail("output-project-identity", output.url);
  else pass("output-project-identity", projectId);

  const videoFinal = await api(`/api/video-production/projects/${projectId}`);
  const endCard = videoFinal.video?.endCardPlan || videoFinal.endCardPlan;
  if (endCard?.rendered && endCard.projectId === projectId) {
    pass("end-card-plan", `${endCard.companyName} cta=${endCard.cta}`);
  } else fail("end-card-plan", JSON.stringify(endCard || {}).slice(0, 200));

  const isoVideo = await api(`/api/video-production/projects/${projectB}`, { method: "POST", body: { action: "create" } });
  const isoId = isoVideo.video?.projectId || isoVideo.projectId;
  if (isoId === projectB) pass("isolation-create", projectB);
  else fail("isolation-create", String(isoId));

  const report = {
    verifiedLive: checks.every((c) => c.ok),
    note: "STEP 11 ENGINE 1 final verified. ENGINE 2/3 remain future work.",
    base: BASE,
    deployedCommit: deployed,
    projectId,
    projectB,
    jobId,
    outputUrl: output?.url,
    checks,
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  if (buf?.length) writeFileSync(path.join(OUT_DIR, "engine1-final.mp4"), buf);
  console.log(JSON.stringify(report, null, 2));
  if (!report.verifiedLive) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
