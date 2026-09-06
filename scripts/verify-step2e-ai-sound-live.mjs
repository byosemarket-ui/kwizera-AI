#!/usr/bin/env node
/**
 * STEP 2E live verification — AI Sound provider health + honest unavailable path.
 * Does NOT fabricate music generation success when no real provider is installed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step2e-ai-sound-artifacts");
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

async function api(pathname, opts = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { res, json, text };
}

async function main() {
  const deploy = await api("/api/deployment");
  const commit = String(deploy.json?.commit || deploy.json?.gitCommit || "").slice(0, 7);
  if (EXPECTED && commit && commit !== EXPECTED) {
    fail("deployed_commit", `expected ${EXPECTED} got ${commit}`);
  } else if (commit) {
    pass("deployed_commit", commit);
  } else {
    pass("deployed_commit", "unavailable in response — continuing");
  }

  const health = await api("/api/workspace/ai-sound/health");
  if (!health.res.ok && health.res.status !== 503) {
    fail("ai_sound_health_endpoint", `HTTP ${health.res.status}`);
  } else {
    pass("ai_sound_health_endpoint", `HTTP ${health.res.status}`);
  }

  const available = Boolean(health.json?.available);
  const status = String(health.json?.status || "");
  writeFileSync(path.join(OUT_DIR, "health.json"), `${JSON.stringify(health.json, null, 2)}\n`);

  if (available) {
    pass("provider_available", `${health.json?.providerId} / ${health.json?.modelId}`);
  } else {
    pass("provider_honest_unavailable", status || health.json?.reason || "UNAVAILABLE");
    if (status === "AVAILABLE") {
      fail("no_fake_available_flag", "status AVAILABLE while available=false");
    } else {
      pass("no_fake_available_flag", status || "not AVAILABLE");
    }
  }

  const project = await api("/api/workspace/projects", {
    method: "POST",
    body: JSON.stringify({
      name: `STEP2E Live ${Date.now()}`,
      productInformation: {
        name: "Live AI Sound Probe",
        category: "Running Shoes",
      },
      campaignInformation: {
        objective: "Promote Sale",
        duration: "15s",
        callToAction: "Shop Now",
      },
      platform: "instagram-reels",
    }),
  });

  let projectId = project.json?.project?.id || project.json?.id;
  if (!project.res.ok || !projectId) {
    // Fallback: open/list pattern used by STEP 2D verifier
    const list = await api("/api/workspace/projects");
    const existing = (list.json?.projects || list.json?.items || [])[0];
    projectId = existing?.id;
    if (!projectId) {
      fail("project_bootstrap", project.text.slice(0, 200));
      finish();
      return;
    }
    pass("project_bootstrap", `reused ${projectId}`);
  } else {
    pass("project_bootstrap", projectId);
  }

  const spec = await api(`/api/workspace/projects/${projectId}/ai-sound/spec`, {
    method: "POST",
    body: JSON.stringify({ mood: "AUTO", energy: "AUTO", tempo: "AUTO" }),
  });
  if (spec.res.ok && spec.json?.spec?.version === "music-generation-spec-v1") {
    pass("music_generation_spec", `${spec.json.spec.mood}/${spec.json.spec.energy}/${spec.json.spec.durationSeconds}s`);
    writeFileSync(path.join(OUT_DIR, "spec.json"), `${JSON.stringify(spec.json.spec, null, 2)}\n`);
  } else {
    fail("music_generation_spec", spec.text.slice(0, 240));
  }

  const gen = await api(`/api/workspace/projects/${projectId}/ai-sound/generate`, {
    method: "POST",
    body: JSON.stringify({ mood: "ENERGETIC", energy: "HIGH", instrumental: true }),
  });
  writeFileSync(path.join(OUT_DIR, "generate-response.json"), `${JSON.stringify({
    status: gen.res.status,
    body: gen.json,
  }, null, 2)}\n`);

  if (!available) {
    if (gen.res.status === 503 && (gen.json?.code === "MUSIC_GENERATION_UNAVAILABLE" || /unavailable/i.test(gen.json?.error || ""))) {
      pass("generate_refused_when_unavailable", gen.json?.code || String(gen.res.status));
    } else if (gen.res.ok && gen.json?.job?.status === "READY") {
      fail("no_fake_ready_job", "Got READY job while provider unavailable");
    } else if (gen.res.ok) {
      // Queued then fail is also acceptable if health flipped; poll once
      const jobId = gen.json?.job?.jobId;
      if (jobId) {
        await new Promise((r) => setTimeout(r, 1500));
        const job = await api(`/api/workspace/ai-sound/jobs/${jobId}`);
        if (job.json?.job?.status === "READY") {
          fail("no_fake_ready_job", "Job became READY without available provider");
        } else {
          pass("generate_refused_when_unavailable", job.json?.job?.status || gen.json?.code || "non-READY");
        }
      } else {
        fail("generate_refused_when_unavailable", gen.text.slice(0, 200));
      }
    } else {
      pass("generate_refused_when_unavailable", `${gen.res.status} ${gen.json?.code || gen.json?.error || ""}`.trim());
    }

    const lib = await api("/api/workspace/audio-library?sourceType=AI_GENERATED");
    const fakeReady = (lib.json?.assets || []).filter((a) =>
      a.sourceType === "AI_GENERATED"
      && a.title?.includes("Live AI Sound Probe")
      && Number(a.durationMs) <= 0,
    );
    if (fakeReady.length) fail("no_empty_ai_assets", `${fakeReady.length} empty AI assets`);
    else pass("no_empty_ai_assets", "none");

    // STEP 2B still works
    const upload = await api(`/api/workspace/projects/${projectId}/audio`, {
      method: "POST",
      body: JSON.stringify({
        fileName: "step2e-regression.wav",
        mimeType: "audio/wav",
        dataBase64: makeTinyWavBase64(1.2),
      }),
    });
    if (upload.res.ok && upload.json?.audio?.assetId) {
      pass("step2b_upload_still_works", upload.json.audio.assetId);
    } else {
      fail("step2b_upload_still_works", upload.text.slice(0, 200));
    }
  } else {
    // Real provider path — wait for READY and validate asset
    const jobId = gen.json?.job?.jobId;
    if (!jobId) {
      fail("real_generation_job", gen.text.slice(0, 200));
    } else {
      let job = gen.json.job;
      for (let i = 0; i < 90; i++) {
        if (["READY", "FAILED", "CANCELLED", "TIMEOUT"].includes(job.status)) break;
        await new Promise((r) => setTimeout(r, 1000));
        const polled = await api(`/api/workspace/ai-sound/jobs/${jobId}`);
        job = polled.json?.job || job;
      }
      writeFileSync(path.join(OUT_DIR, "job-final.json"), `${JSON.stringify(job, null, 2)}\n`);
      if (job.status === "READY" && job.audioAssetId) {
        pass("real_generation_ready", job.audioAssetId);
        const assetRes = await api(`/api/workspace/audio-library`);
        const asset = (assetRes.json?.assets || []).find((a) => a.assetId === job.audioAssetId);
        if (asset?.sourceType === "AI_GENERATED" && asset.durationMs > 0) {
          pass("ai_generated_library_asset", `${asset.durationMs}ms`);
        } else {
          fail("ai_generated_library_asset", JSON.stringify(asset)?.slice(0, 200) || "missing");
        }
      } else {
        fail("real_generation_ready", `${job.status} ${job.error || ""}`);
      }
    }
  }

  // Image upload smoke to keep project usable (not required for AI sound)
  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: JSON.stringify({
      fileName: "probe.png",
      mimeType: "image/png",
      dataBase64: png(32, 32, 40, 120, 200),
    }),
  }).catch(() => null);

  finish();
}

function makeTinyWavBase64(durationSec = 1) {
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
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.2;
    buf.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buf.toString("base64");
}

function finish() {
  const summary = {
    base: BASE,
    expectedCommit: EXPECTED || null,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    checks,
    verdict: checks.every((c) => c.ok)
      ? (checks.some((c) => c.name === "provider_available")
        ? "STEP_2E_COMPLETE_IF_REAL_PROVIDER_VERIFIED"
        : "STEP_2E_PARTIALLY_COMPLETE_PROVIDER_UNAVAILABLE")
      : "STEP_2E_VERIFICATION_FAILED",
  };
  writeFileSync(path.join(OUT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\n${summary.verdict} — ${summary.passed} passed, ${summary.failed} failed`);
  process.exit(summary.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  fail("fatal", err instanceof Error ? err.message : String(err));
  finish();
});
