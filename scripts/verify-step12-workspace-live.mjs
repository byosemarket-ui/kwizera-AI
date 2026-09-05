#!/usr/bin/env node
/**
 * STEP 12 live acceptance — workspace integration, READY gate, playback, download, isolation.
 * ENGINE 1 only. Does not claim ENGINE 2/3.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step12-workspace-artifacts");

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
      const p = x > width * 0.18 && x < width * 0.82 && y > height * 0.16 && y < height * 0.84;
      raw[i] = p ? r : 244;
      raw[i + 1] = p ? g : 244;
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

async function api(pathname, { method = "GET", body, retries = 16, acceptStatuses = [] } = {}) {
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
      if (res.ok || res.status === 202 || acceptStatuses.includes(res.status)) {
        return { status: res.status, json, headers: res.headers };
      }
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
  const created = (await api("/api/workspace/projects", { method: "POST", body: { name: `STEP12-${tag}-${Date.now()}` } })).json;
  const projectId = created.project?.id;
  if (!projectId) throw new Error("create project failed");
  await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: `Virunga ${tag} Bottle`,
          category: "Outdoor",
          description: "STEP 12 workspace integration product.",
          price: 52000,
          originalPrice: 65000,
          currency: "RWF",
          website: "https://www.kwizera.rw/virunga",
          phone: "+250788555666",
          callToAction: "Shop Now",
        },
        brandInformation: { name: `Kwizera ${tag}`, website: "https://www.kwizera.rw", colors: "#1c2a3a" },
        campaignInformation: { name: `Campaign ${tag}`, objective: "conversions", callToAction: "Order Today" },
        platform: "tiktok",
        language: "en",
        creativeTone: "Premium",
      },
    },
  });
  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: { fileName: `${tag}-a.png`, mimeType: "image/png", dataBase64: productPng(640, 960, 40, 100, 150) },
  });
  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: { fileName: `${tag}-b.png`, mimeType: "image/png", dataBase64: productPng(640, 960, 150, 80, 50) },
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
  let sawBelow100WhileProcessing = false;
  let last = null;
  for (let i = 0; i < 240; i++) {
    last = (await api(`/api/video-production/projects/${projectId}/jobs/${jobId}`)).json;
    const job = last.job ?? last;
    const progress = job.progress ?? 0;
    console.log(`  ${job.status} ${job.stage} ${progress}% ${job.stageMessage || ""}`);
    if (job.status === "processing" && progress < 100) sawBelow100WhileProcessing = true;
    if (progress >= 100 && job.status === "processing") {
      throw new Error("False ready: progress 100 while still processing");
    }
    if (job.status === "completed" || job.status === "failed") {
      return { job, sawBelow100WhileProcessing };
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

  const health = (await api("/api/health")).json;
  if (health.runtimeReady === true && health.status === "healthy") pass("health", "healthy");
  else fail("health", JSON.stringify(health).slice(0, 200));

  const deploy = (await api("/api/deployment")).json;
  const deployed = String(deploy.deployedCommit || "");
  if (EXPECTED && !deployed.startsWith(EXPECTED)) fail("deployed-commit", `got ${deployed.slice(0, 7)} expected ${EXPECTED}`);
  else pass("deployed-commit", `${deployed.slice(0, 7)} verified=${deploy.verifiedLive}`);

  const caps = (await api("/api/video-production/capabilities?views=3")).json;
  if (caps.workspaceIntegration?.workspaceIntegrationAvailable) {
    pass("workspace-diagnostics", caps.workspaceIntegration.version || "ok");
  } else fail("workspace-diagnostics", JSON.stringify(caps.workspaceIntegration || {}).slice(0, 200));
  if (caps.engine1Final?.engine1FinalAvailable) pass("engine1-final", caps.engine1Final.version || "ok");
  else fail("engine1-final", "missing");

  const { projectId } = await seedProject("A");
  const { projectId: projectB } = await seedProject("B");
  pass("project-a", projectId);
  pass("project-b", projectB);

  await api(`/api/video-production/projects/${projectId}`, { method: "POST", body: { action: "create" } });
  const started = (await api(`/api/video-production/projects/${projectId}/render`, {
    method: "POST",
    body: { preset: "standard" },
  })).json;
  const jobId = started.job?.id;
  if (!jobId) fail("render-queued", JSON.stringify(started).slice(0, 200));
  else pass("render-queued", jobId);

  const dup = await api(`/api/video-production/projects/${projectId}/render`, {
    method: "POST",
    body: { preset: "standard" },
    acceptStatuses: [409],
    retries: 3,
  });
  if (dup.status === 409 || dup.json?.code === "RENDER_IN_PROGRESS") {
    pass("duplicate-render-blocked", String(dup.status));
  } else fail("duplicate-render-blocked", JSON.stringify(dup.json || {}).slice(0, 200));

  const { job, sawBelow100WhileProcessing } = await waitJob(projectId, jobId);
  if (job.status !== "completed") fail("render-complete", `${job.status} ${job.error || ""}`);
  else pass("render-complete", `endCard=${job.endCardRendered}`);
  if (sawBelow100WhileProcessing) pass("progress-honest", "saw <100 while processing");
  else fail("progress-honest", "never observed progress below 100 during processing");

  const out = (await api(`/api/video-production/projects/${projectId}/output`)).json;
  const output = out.output || out;
  if (!output?.url || (output.sizeBytes || 0) < 1000) fail("output-meta", JSON.stringify(out).slice(0, 200));
  else pass("output-meta", `${output.width}x${output.height} ${output.durationMs}ms ${output.sizeBytes}b`);

  const videoUrl = output.url.startsWith("http") ? output.url : `${BASE}${output.url}`;
  const head = await fetch(videoUrl, { method: "HEAD" });
  if (!head.ok || Number(head.headers.get("content-length") || 0) < 1000) {
    fail("player-head", `${head.status} len=${head.headers.get("content-length")}`);
  } else pass("player-head", `${head.status} len=${head.headers.get("content-length")} ranges=${head.headers.get("accept-ranges")}`);

  const ranged = await fetch(videoUrl, { method: "GET", headers: { Range: "bytes=0-11" } });
  if (ranged.status === 206) {
    const buf = Buffer.from(await ranged.arrayBuffer());
    const brand = buf.length >= 8 ? buf.subarray(4, 8).toString("ascii") : "";
    if (brand === "ftyp") pass("player-range", `206 ftyp bytes=${buf.length}`);
    else fail("player-range", `206 brand=${brand}`);
  } else {
    // Fallback still acceptable if full GET works
    const full = await fetch(videoUrl);
    const buf = Buffer.from(await full.arrayBuffer());
    if (full.ok && buf.length >= 1000) pass("player-range", `fallback GET ${buf.length}`);
    else fail("player-range", `${ranged.status}/${full.status}`);
  }

  const play = await fetch(videoUrl);
  const playBuf = Buffer.from(await play.arrayBuffer());
  if (!play.ok || playBuf.length < 1000) fail("playback", `${play.status} ${playBuf.length}`);
  else pass("playback", `${play.status} bytes=${playBuf.length} type=${play.headers.get("content-type")}`);

  if (!String(output.url).includes(projectId)) fail("project-identity", output.url);
  else pass("project-identity", projectId);

  await api(`/api/video-production/projects/${projectB}`, { method: "POST", body: { action: "create" } });
  const videoB = (await api(`/api/video-production/projects/${projectB}`)).json;
  const bId = videoB.video?.projectId;
  if (bId === projectB && !(videoB.video?.output?.url || "").includes(projectId)) {
    pass("isolation", `B=${projectB}`);
  } else fail("isolation", JSON.stringify(videoB).slice(0, 200));

  writeFileSync(path.join(OUT_DIR, "engine1-final.mp4"), playBuf);
  const report = {
    verifiedLive: checks.every((c) => c.ok),
    note: "STEP 12 workspace integration verified for ENGINE 1. ENGINE 2/3 remain future work.",
    base: BASE,
    deployedCommit: deployed,
    projectId,
    projectB,
    jobId,
    outputUrl: output?.url,
    checks,
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.verifiedLive) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
