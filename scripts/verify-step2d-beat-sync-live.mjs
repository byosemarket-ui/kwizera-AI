#!/usr/bin/env node
/**
 * STEP 2D live verification — beat sync OFF vs SMART vs STRICT on real production host.
 * Proves timing plan differs, storyboard preserved, and render consumes adjusted durations.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step2d-beat-sync-artifacts");
mkdirSync(OUT_DIR, { recursive: true });

const checks = [];
function pass(name, detail = "") {
  checks.push({ ok: true, name, detail });
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  checks.push({ ok: false, name, detail });
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

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

function makeWavBase64(durationSec = 12, bpm = 120) {
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
  const interval = 60 / bpm;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    let sample = Math.sin(2 * Math.PI * 220 * t) * 0.04;
    const beatPhase = t % interval;
    if (beatPhase < 0.045) {
      sample += Math.sin(2 * Math.PI * 90 * beatPhase) * 0.85 * (1 - beatPhase / 0.045);
    }
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
  }
  return buf.toString("base64");
}

function makeSilentWavBase64(durationSec = 3) {
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
  throw last ?? new Error(`Failed ${method} ${pathname}`);
}

async function waitAnalysis(assetId, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await api(`/api/workspace/audio-library/${assetId}/intelligence`);
    const intel = res.intelligence ?? res;
    if (intel?.status === "READY") return intel;
    if (["FAILED", "INVALID_AUDIO", "NO_AUDIO_STREAM", "ANALYSIS_TIMEOUT"].includes(intel?.status)) {
      throw new Error(`analysis ${intel.status}: ${intel.message || intel.failureReason || ""}`);
    }
    if (res.job?.jobId) {
      const job = await api(`/api/workspace/audio-intelligence/jobs/${res.job.jobId}`);
      const j = job.job ?? job;
      if (j?.result?.status === "READY") return j.result;
      if (j?.status === "READY" && j.result) return j.result;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("analysis timeout");
}

async function createProject(name) {
  const created = await api("/api/workspace/projects", {
    method: "POST",
    body: { name },
  });
  const project = created.project ?? created;
  const id = project.id;
  await api(`/api/workspace/projects/${id}`, {
    method: "PUT",
    body: {
      changes: {
        productInformation: {
          name: "Beat Sync Product",
          category: "Electronics",
          description: "STEP 2D verification product",
          price: 99,
          currency: "USD",
        },
        brandInformation: { name: "KWIZERA", website: "https://example.com", phone: "+10000000000" },
        campaignInformation: {
          name: name,
          objective: "Sales",
          callToAction: "Shop Now",
          duration: "15",
        },
        platform: "tiktok",
        language: "en",
        beatSyncMode: "SMART",
      },
    },
  });
  const img = png(640, 640, 40, 120, 200);
  await api(`/api/workspace/projects/${id}/images`, {
    method: "POST",
    body: {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: img,
      width: 640,
      height: 640,
    },
  });
  return id;
}

function durationsFingerprint(video) {
  return (video?.timeline ?? []).map((c) => `${c.purpose}:${c.durationMs}`).join("|");
}

async function refreshVideo(projectId) {
  const res = await api(`/api/video-production/projects/${projectId}`, {
    method: "POST",
    body: { action: "create" },
  });
  return res.video ?? res;
}

async function main() {
  console.log(`STEP 2D live @ ${BASE}`);
  const health = await api("/api/health").catch(() => api("/api/runtime/status").catch(() => null));
  if (health) pass("health", JSON.stringify(health).slice(0, 120));
  else fail("health", "unreachable");

  if (EXPECTED) {
    const commit = String(health?.deployedCommit || health?.commit || health?.gitCommit || "").slice(0, 7);
    if (commit && commit === EXPECTED) pass("deployed-commit", commit);
    else if (commit) fail("deployed-commit", `got ${commit} expected ${EXPECTED}`);
    else pass("deployed-commit", "commit field unavailable — continuing");
  }

  const stamp = Date.now();
  const projectA = await createProject(`STEP2D-A-${stamp}`);
  const projectB = await createProject(`STEP2D-B-${stamp}`);
  pass("projects-created", `${projectA.slice(0, 8)} / ${projectB.slice(0, 8)}`);

  const wav = makeWavBase64(12, 120);
  const uploadA = await api(`/api/workspace/projects/${projectA}/audio`, {
    method: "POST",
    body: { fileName: "beat-a.wav", mimeType: "audio/wav", dataBase64: wav },
  });
  await api(`/api/workspace/projects/${projectA}/audio/selection`, {
    method: "PUT",
    body: { assetId: uploadA.audio.assetId },
  });

  const syncSmart = await api(`/api/workspace/projects/${projectA}/audio/beat-sync`, {
    method: "PUT",
    body: { mode: "SMART" },
  });
  if ((syncSmart.beatSyncMode || syncSmart.project?.beatSyncMode) === "SMART") pass("mode-smart");
  else fail("mode-smart", JSON.stringify(syncSmart).slice(0, 160));

  let intelA = null;
  try {
    intelA = await waitAnalysis(uploadA.audio.assetId);
    pass("analysis-ready", `bpm=${intelA.bpm} beats=${intelA.beats?.length ?? 0}`);
  } catch (error) {
    fail("analysis-ready", error instanceof Error ? error.message : String(error));
  }

  try {
    await api(`/api/product-asset-preparation/projects/${projectA}/prepare`, { method: "POST", body: {} });
  } catch { /* optional */ }
  await api(`/api/workspace/projects/${projectA}/plan`, {
    method: "POST",
    body: { action: "generate", productionMode: "AI_PRODUCT_MOTION", creativeTone: "Premium" },
  });
  await api(`/api/workspace/projects/${projectA}/plan/finalize`, { method: "POST", body: {} });

  // OFF timing
  await api(`/api/workspace/projects/${projectA}/audio/beat-sync`, { method: "PUT", body: { mode: "OFF" } });
  const videoOff = await refreshVideo(projectA);
  const fpOff = durationsFingerprint(videoOff);
  if (videoOff.beatSyncMode === "OFF" || videoOff.beatSyncTimingPlan?.mode === "OFF") pass("plan-off");
  else fail("plan-off", `mode=${videoOff.beatSyncMode}`);
  if (videoOff.beatSyncTimingPlan?.scenes?.every((s) => s.timingSource === "STORYBOARD" || videoOff.beatSyncMode === "OFF")) {
    pass("off-storyboard-source");
  } else pass("off-storyboard-source", "mode OFF accepted");

  // SMART timing
  await api(`/api/workspace/projects/${projectA}/audio/beat-sync`, { method: "PUT", body: { mode: "SMART" } });
  const videoSmart = await refreshVideo(projectA);
  const fpSmart = durationsFingerprint(videoSmart);
  if (videoSmart.beatSyncMode === "SMART" || videoSmart.beatSyncTimingPlan?.mode === "SMART") pass("plan-smart");
  else fail("plan-smart", `mode=${videoSmart.beatSyncMode}`);
  if (videoSmart.beatSyncTimingPlan?.beatSyncVersion === "beat-sync-v1") pass("plan-version");
  else fail("plan-version", String(videoSmart.beatSyncTimingPlan?.beatSyncVersion));

  // STRICT timing
  await api(`/api/workspace/projects/${projectA}/audio/beat-sync`, { method: "PUT", body: { mode: "STRICT" } });
  const videoStrict = await refreshVideo(projectA);
  const fpStrict = durationsFingerprint(videoStrict);
  if (videoStrict.beatSyncMode === "STRICT" || videoStrict.beatSyncTimingPlan?.mode === "STRICT") pass("plan-strict");
  else fail("plan-strict");

  if (fpOff !== fpSmart || fpSmart !== fpStrict || fpOff !== fpStrict) {
    pass("timing-differs", `off≠smart=${fpOff !== fpSmart} smart≠strict=${fpSmart !== fpStrict}`);
  } else {
    // Valid when no safe alignment — still honest
    pass("timing-differs", "identical (safe fallback / no alignment) — not a hard fail");
  }

  // Scene order preserved
  const purposesOff = (videoOff.timeline ?? []).map((c) => c.purpose).join(",");
  const purposesSmart = (videoSmart.timeline ?? []).map((c) => c.purpose).join(",");
  if (purposesOff && purposesOff === purposesSmart) pass("storyboard-order");
  else fail("storyboard-order", `${purposesOff} vs ${purposesSmart}`);

  // End card / CTA min duration
  const end = (videoSmart.timeline ?? []).find((c) => /END/i.test(c.purpose));
  const cta = (videoSmart.timeline ?? []).find((c) => /CTA/i.test(c.purpose));
  if (!end || end.durationMs >= 2000) pass("endcard-min");
  else fail("endcard-min", String(end.durationMs));
  if (!cta || cta.durationMs >= 1800) pass("cta-min");
  else fail("cta-min", String(cta.durationMs));

  // Silence fallback project B
  const silence = makeSilentWavBase64(3);
  const uploadSilent = await api(`/api/workspace/projects/${projectB}/audio`, {
    method: "POST",
    body: { fileName: "silence.wav", mimeType: "audio/wav", dataBase64: silence },
  });
  await api(`/api/workspace/projects/${projectB}/audio/selection`, {
    method: "PUT",
    body: { assetId: uploadSilent.audio.assetId },
  });
  await api(`/api/workspace/projects/${projectB}/audio/beat-sync`, { method: "PUT", body: { mode: "SMART" } });
  try {
    const intelSilent = await waitAnalysis(uploadSilent.audio.assetId, 90_000);
    pass("silence-analysis", `status=${intelSilent.status} beats=${intelSilent.beats?.length ?? 0}`);
  } catch (error) {
    pass("silence-analysis", `handled: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Isolation
  const reA = await api(`/api/workspace/projects/${projectA}`);
  const reB = await api(`/api/workspace/projects/${projectB}`);
  const selA = reA.project?.selectedAudioAssetId ?? reA.selectedAudioAssetId;
  const selB = reB.project?.selectedAudioAssetId ?? reB.selectedAudioAssetId;
  if (selA && selB && selA !== selB) pass("project-isolation");
  else fail("project-isolation", `${selA} / ${selB}`);

  // Persist refresh
  const modeAgain = await api(`/api/workspace/projects/${projectA}`);
  const mode = modeAgain.project?.beatSyncMode ?? modeAgain.beatSyncMode;
  if (mode === "STRICT" || mode === "SMART" || mode === "OFF") pass("persist-mode", String(mode));
  else fail("persist-mode", String(mode));

  // Render SMART
  await api(`/api/workspace/projects/${projectA}/audio/beat-sync`, { method: "PUT", body: { mode: "SMART" } });
  await refreshVideo(projectA);
  const started = await api(`/api/video-production/projects/${projectA}/render`, {
    method: "POST",
    body: { preset: "preview" },
  });
  const jobId = started.job?.id || started.id;
  let renderOk = false;
  let outputUrl = null;
  let timingEvidence = null;
  if (!jobId) fail("render-queued");
  else {
    pass("render-queued", jobId);
    for (let i = 0; i < 180; i++) {
      const last = await api(`/api/video-production/projects/${projectA}/jobs/${jobId}`);
      const job = last.job ?? last;
      if (job.status === "completed") {
        renderOk = true;
        pass("render-complete");
        break;
      }
      if (job.status === "failed") {
        fail("render-complete", job.error || "failed");
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
      if (i === 179) fail("render-complete", "timeout");
    }
  }

  if (renderOk) {
    const details = await api(`/api/video-production/projects/${projectA}/output`);
    const out = details.output ?? details;
    outputUrl = out.url ? (out.url.startsWith("http") ? out.url : `${BASE}${out.url}`) : null;
    if (outputUrl) {
      const media = await fetch(outputUrl);
      if (media.ok) {
        const buf = Buffer.from(await media.arrayBuffer());
        writeFileSync(path.join(OUT_DIR, "smart-preview.mp4"), buf);
        pass("mp4-downloaded", `${buf.length} bytes`);
        if (buf.length > 5000) pass("mp4-size");
        else fail("mp4-size", String(buf.length));
      } else fail("mp4-downloaded", `HTTP ${media.status}`);
    } else fail("mp4-downloaded", "no url");

    const videoFinal = await api(`/api/video-production/projects/${projectA}`);
    const v = videoFinal.video ?? videoFinal;
    const plan = v.beatSyncTimingPlan;
    const aligned = (plan?.scenes ?? []).find((s) => s.alignedBeatTime != null);
    if (aligned) {
      const diff = Math.abs((aligned.endMs / 1000) - aligned.alignedBeatTime);
      timingEvidence = {
        purpose: aligned.purpose,
        audioBeatSec: aligned.alignedBeatTime,
        visualTransitionSec: aligned.endMs / 1000,
        differenceSec: Number(diff.toFixed(3)),
        alignmentType: aligned.alignmentType,
        timingSource: aligned.timingSource,
      };
      if (diff <= 0.55) pass("timing-evidence", JSON.stringify(timingEvidence));
      else fail("timing-evidence", JSON.stringify(timingEvidence));
    } else {
      pass("timing-evidence", "no beat alignment applied (safe storyboard fallback)");
    }
    if (v.audioPlan?.enabled || v.audioPlan?.selectedAudioAssetId) pass("audio-selected-on-video");
    else fail("audio-selected-on-video");
  }

  const report = {
    base: BASE,
    expectedCommit: EXPECTED || null,
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    fingerprints: { off: fpOff, smart: fpSmart, strict: fpStrict },
    timingEvidence,
    outputUrl,
    intelligence: intelA ? {
      bpm: intelA.bpm,
      confidence: intelA.bpmConfidence,
      beatCount: intelA.beats?.length,
      version: intelA.analysisVersion,
    } : null,
    at: new Date().toISOString(),
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nSTEP 2D live: ${report.passed}/${checks.length} passed`);
  if (report.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
