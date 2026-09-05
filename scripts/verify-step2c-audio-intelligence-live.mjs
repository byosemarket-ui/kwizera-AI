#!/usr/bin/env node
/**
 * STEP 2C live verification — select audio → analyze → persist → isolate → render still works.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step2c-audio-intel-artifacts");

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
function png(width, height, r, g, b) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

function makeWavBase64(durationSec = 4, freq = 440) {
  const sampleRate = 22050;
  const samples = Math.floor(sampleRate * durationSec);
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  const bpm = 120;
  const interval = 60 / bpm;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    let sample = Math.sin(2 * Math.PI * freq * t) * 0.05;
    const beatPhase = t % interval;
    if (beatPhase < 0.04) sample += Math.sin(2 * Math.PI * 80 * beatPhase) * 0.7 * (1 - beatPhase / 0.04);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
  }
  return buf.toString("base64");
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
      if (res.ok || res.status === 202) return json ?? { ok: true, status: res.status };
      last = new Error(`${method} ${pathname} -> ${res.status}: ${text.slice(0, 400)}`);
      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 + attempt * 1000));
        continue;
      }
      throw last;
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
      await new Promise((r) => setTimeout(r, 1500 + attempt * 500));
    }
  }
  throw last ?? new Error("api failed");
}

async function waitAnalysis(assetId) {
  for (let i = 0; i < 90; i++) {
    const res = await api(`/api/workspace/audio-library/${assetId}/intelligence`);
    const status = res.status || res.intelligence?.status || res.job?.status;
    console.log(`  analysis ${status} ${res.job?.progress ?? ""}`);
    if (res.intelligence?.status === "READY") return res.intelligence;
    if (["FAILED", "INVALID_AUDIO", "NO_AUDIO_STREAM", "ANALYSIS_TIMEOUT"].includes(status)) {
      throw new Error(`analysis failed: ${status} ${res.job?.error || ""}`);
    }
    if (res.job?.jobId) {
      const job = await api(`/api/workspace/audio-intelligence/jobs/${res.job.jobId}`);
      if (job.job?.result?.status === "READY") return job.job.result;
      if (["FAILED", "INVALID_AUDIO", "NO_AUDIO_STREAM", "ANALYSIS_TIMEOUT"].includes(job.job?.status)) {
        throw new Error(`job failed: ${job.job.status}`);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("analysis timeout");
}

async function seedProject(tag) {
  const created = await api("/api/workspace/projects", {
    method: "POST",
    body: { name: `STEP2C-${tag}-${Date.now()}` },
  });
  const projectId = created.project?.id;
  if (!projectId) throw new Error("create failed");
  await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: `Intel Product ${tag}`,
          category: "Fashion",
          description: "STEP 2C audio intelligence live test",
          price: 35000,
          currency: "RWF",
        },
        brandInformation: { name: `Intel Brand ${tag}` },
        campaignInformation: { name: `Camp ${tag}`, objective: "showcase", callToAction: "Shop Now" },
        platform: "tiktok",
        language: "English",
      },
    },
  });
  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: {
      fileName: `${tag}-hero.png`,
      mimeType: "image/png",
      dataBase64: png(480, 720, 40, 90, 160),
    },
  });
  return projectId;
}

async function main() {
  const checks = [];
  const pass = (n, d = "") => { checks.push({ name: n, ok: true, detail: d }); console.log(`✓ ${n}${d ? ` — ${d}` : ""}`); };
  const fail = (n, d = "") => { checks.push({ name: n, ok: false, detail: d }); console.error(`✗ ${n}${d ? ` — ${d}` : ""}`); };
  mkdirSync(OUT_DIR, { recursive: true });

  const health = await api("/api/health");
  if (health.runtimeReady) pass("health"); else fail("health", JSON.stringify(health).slice(0, 120));

  const deploy = await api("/api/deployment");
  const deployed = String(deploy.deployedCommit || "");
  if (!EXPECTED) pass("deployed-commit", `${deployed.slice(0, 12)} (no expect pin)`);
  else if (deployed.startsWith(EXPECTED) && deploy.verifiedLive) pass("deployed-commit", deployed.slice(0, 12));
  else fail("deployed-commit", `${deployed.slice(0, 12)} expected=${EXPECTED}`);

  const projectA = await seedProject("A");
  const projectB = await seedProject("B");
  pass("projects", `${projectA.slice(0, 8)} / ${projectB.slice(0, 8)}`);

  const wavA = makeWavBase64(5, 440);
  const wavB = makeWavBase64(4, 330);
  const uploadA = await api(`/api/workspace/projects/${projectA}/audio`, {
    method: "POST",
    body: { fileName: "beat-120.wav", mimeType: "audio/wav", dataBase64: wavA },
  });
  if (!uploadA.audio?.assetId) fail("upload-a", JSON.stringify(uploadA).slice(0, 160));
  else pass("upload-a", uploadA.audio.assetId);

  await api(`/api/workspace/projects/${projectA}/audio/selection`, {
    method: "PUT",
    body: { assetId: uploadA.audio.assetId },
  });

  let intelA;
  try {
    intelA = await waitAnalysis(uploadA.audio.assetId);
    pass("analysis-ready", `bpm=${intelA.bpm} conf=${intelA.bpmConfidence} beats=${intelA.beats?.length}`);
  } catch (error) {
    fail("analysis-ready", error instanceof Error ? error.message : String(error));
  }

  const again = await api(`/api/workspace/audio-library/${uploadA.audio.assetId}/intelligence`);
  if (again.intelligence?.status === "READY" && again.reused !== false) {
    // GET may re-ensure; cache hit should be READY immediately
    pass("analysis-cache", again.intelligence.analysisVersion || "v1");
  } else if (again.intelligence?.status === "READY") {
    pass("analysis-cache", "ready");
  } else fail("analysis-cache", JSON.stringify(again).slice(0, 160));

  if (intelA?.beats?.length > 0 && intelA.energyTimeline?.length > 0) {
    pass("timeline-present", `beats=${intelA.beats.length} energy=${intelA.energyTimeline.length}`);
  } else fail("timeline-present");

  const uploadB = await api(`/api/workspace/projects/${projectB}/audio`, {
    method: "POST",
    body: { fileName: "beat-b.wav", mimeType: "audio/wav", dataBase64: wavB },
  });
  await api(`/api/workspace/projects/${projectB}/audio/selection`, {
    method: "PUT",
    body: { assetId: uploadB.audio.assetId },
  });
  const intelB = await waitAnalysis(uploadB.audio.assetId);
  if (intelB.contentHash !== intelA?.contentHash) pass("isolation-content", `${intelA?.contentHash?.slice(0, 8)} / ${intelB.contentHash.slice(0, 8)}`);
  else fail("isolation-content", "same hash unexpectedly");

  const reA = await api(`/api/workspace/projects/${projectA}`);
  const selA = reA.project?.selectedAudioAssetId ?? reA.selectedAudioAssetId;
  if (selA === uploadA.audio.assetId) pass("persist-selection"); else fail("persist-selection", String(selA));

  // Regression: video still renders with selected audio (beat sync not required)
  try {
    await api(`/api/product-asset-preparation/projects/${projectA}/prepare`, { method: "POST", body: {} });
  } catch { /* optional */ }
  await api(`/api/workspace/projects/${projectA}/plan`, {
    method: "POST",
    body: { action: "generate", productionMode: "AI_PRODUCT_MOTION", creativeTone: "Premium" },
  });
  await api(`/api/workspace/projects/${projectA}/plan/finalize`, { method: "POST", body: {} });
  await api(`/api/video-production/projects/${projectA}`, { method: "POST", body: { action: "create" } });
  const started = await api(`/api/video-production/projects/${projectA}/render`, {
    method: "POST",
    body: { preset: "preview" },
  });
  const jobId = started.job?.id || started.id;
  if (!jobId) fail("render-queued");
  else {
    pass("render-queued", jobId);
    for (let i = 0; i < 180; i++) {
      const last = await api(`/api/video-production/projects/${projectA}/jobs/${jobId}`);
      const job = last.job ?? last;
      if (job.status === "completed") { pass("render-complete"); break; }
      if (job.status === "failed") { fail("render-complete", job.error || "failed"); break; }
      await new Promise((r) => setTimeout(r, 2000));
      if (i === 179) fail("render-complete", "timeout");
    }
  }

  const report = {
    base: BASE,
    expectedCommit: EXPECTED || null,
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    intelligence: intelA ? {
      bpm: intelA.bpm,
      confidence: intelA.bpmConfidence,
      beatCount: intelA.beats?.length,
      version: intelA.analysisVersion,
    } : null,
    at: new Date().toISOString(),
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nSTEP 2C live: ${report.passed}/${checks.length} passed`);
  if (report.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
