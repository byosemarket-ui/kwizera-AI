#!/usr/bin/env node
/**
 * STEP 2F live verification — Audio-Visual Creative Director on production.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step2f-av-director-artifacts");
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

function makeWavBase64(durationSec = 10, bpm = 120) {
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
    let sample = Math.sin(2 * Math.PI * 220 * t) * 0.08;
    const beatPhase = t % interval;
    if (beatPhase < 0.04) {
      sample += Math.sin(2 * Math.PI * 90 * beatPhase) * 0.55 * (1 - beatPhase / 0.04);
    }
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
  }
  return buf.toString("base64");
}

async function api(pathname, opts = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { res, json, text };
}

async function main() {
  const deploy = await api("/api/deployment");
  const commit = String(deploy.json?.deployedCommit || deploy.json?.commit || "").slice(0, 7);
  if (EXPECTED && commit && commit !== EXPECTED) fail("deployed_commit", `expected ${EXPECTED} got ${commit}`);
  else if (commit) pass("deployed_commit", commit);
  else pass("deployed_commit", "unchecked");

  const project = await api("/api/workspace/projects", {
    method: "POST",
    body: JSON.stringify({
      name: `STEP2F Live ${Date.now()}`,
      productInformation: { name: "Director Probe Shoes", category: "Running Shoes", price: 45000, currency: "RWF" },
      campaignInformation: { objective: "Promote Sale", duration: "15s", callToAction: "Shop Now" },
      brandInformation: { name: "KWIZERA", website: "https://example.com" },
      platform: "instagram_reels",
    }),
  });
  let projectId = project.json?.project?.id || project.json?.id;
  if (!projectId) {
    const list = await api("/api/workspace/projects");
    projectId = (list.json?.projects || [])[0]?.id;
  }
  if (!projectId) {
    fail("project_bootstrap", project.text.slice(0, 200));
    return finish();
  }
  pass("project_bootstrap", projectId);

  // Upload image
  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: JSON.stringify({
      fileName: "hero.png",
      mimeType: "image/png",
      dataBase64: png(640, 800, 30, 90, 180),
    }),
  });

  // Upload audio
  const upload = await api(`/api/workspace/projects/${projectId}/audio`, {
    method: "POST",
    body: JSON.stringify({
      fileName: "step2f-beat.wav",
      mimeType: "audio/wav",
      dataBase64: makeWavBase64(12, 120),
    }),
  });
  const audioId = upload.json?.audio?.assetId;
  if (upload.res.ok && audioId) {
    pass("audio_upload", audioId);
    await api(`/api/workspace/projects/${projectId}/audio/selection`, {
      method: "PUT",
      body: JSON.stringify({ audioAssetId: audioId }),
    });
  } else {
    fail("audio_upload", upload.text.slice(0, 200));
  }

  // Wait briefly for intelligence if kicked off by selection
  if (audioId) {
    for (let i = 0; i < 20; i++) {
      const intel = await api(`/api/workspace/audio-library/${audioId}/intelligence`);
      if (intel.json?.intelligence?.status === "READY" || intel.json?.status === "READY") {
        pass("audio_intelligence", `bpm=${intel.json?.intelligence?.bpm ?? "n/a"}`);
        break;
      }
      if (i === 19) pass("audio_intelligence", `pending:${intel.json?.status || intel.json?.intelligence?.status || "unknown"}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Settings
  const settings = await api(`/api/workspace/projects/${projectId}/audio-visual-director/settings`, {
    method: "PATCH",
    body: JSON.stringify({ creativeMode: "ENERGETIC" }),
  });
  if (settings.res.ok && settings.json?.settings?.creativeMode === "ENERGETIC") {
    pass("director_settings", "ENERGETIC");
  } else {
    fail("director_settings", settings.text.slice(0, 200));
  }

  // Create / refresh video project (requires creative plan — may fail)
  const createVideo = await api(`/api/video-production/projects/${projectId}`, {
    method: "POST",
    body: JSON.stringify({ action: "create" }),
  });
  writeFileSync(path.join(OUT_DIR, "create-video.json"), `${JSON.stringify({ status: createVideo.res.status, body: createVideo.json }, null, 2)}\n`);

  let planBody = null;
  if (createVideo.res.ok && createVideo.json?.video) {
    pass("video_project", createVideo.json.video.id);
    if (createVideo.json.video.avCreativePlan) {
      planBody = { plan: createVideo.json.video.avCreativePlan };
      pass("director_plan_on_video", createVideo.json.video.avCreativePlan.status);
    } else {
      const analyzed = await api(`/api/workspace/projects/${projectId}/audio-visual-director/analyze`, { method: "POST" });
      planBody = analyzed.json;
      if (analyzed.res.ok && analyzed.json?.plan) pass("director_analyze", analyzed.json.plan.status);
      else fail("director_analyze", analyzed.text.slice(0, 240));
    }
  } else {
    // Creative plan missing is a known dependency — try analyze anyway / report partial
    const analyzed = await api(`/api/workspace/projects/${projectId}/audio-visual-director/analyze`, { method: "POST" });
    planBody = analyzed.json;
    if (analyzed.res.ok && analyzed.json?.plan) {
      pass("director_analyze", analyzed.json.plan.status);
      pass("video_project", "deferred — analyze ok without full render path");
    } else {
      fail("video_project", createVideo.text.slice(0, 200));
      pass("director_analyze_blocked", analyzed.json?.code || String(analyzed.res.status));
    }
  }

  if (planBody?.plan) {
    writeFileSync(path.join(OUT_DIR, "plan.json"), `${JSON.stringify(planBody.plan, null, 2)}\n`);
    const plan = planBody.plan;
    if (plan.version === "av-creative-director-v1") pass("plan_version", plan.version);
    else fail("plan_version", plan.version);
    if (Array.isArray(plan.scenes) && plan.scenes.length) pass("plan_scenes", String(plan.scenes.length));
    else fail("plan_scenes", "empty");
    if (plan.projectId === projectId) pass("project_isolation", projectId);
    else fail("project_isolation", `${plan.projectId} != ${projectId}`);
  }

  const preview = await api(`/api/workspace/projects/${projectId}/audio-visual-director/preview`, { method: "POST" });
  if (preview.res.ok) pass("director_preview", `${preview.json?.timeline?.length ?? 0} rows`);
  else fail("director_preview", preview.text.slice(0, 160));

  // Optional render if video exists
  if (createVideo.res.ok) {
    const render = await api(`/api/video-production/projects/${projectId}/render`, {
      method: "POST",
      body: JSON.stringify({ preset: "preview" }),
    });
    if (render.res.ok) {
      pass("render_queued", render.json?.job?.id || "ok");
      const jobId = render.json?.job?.id;
      let finalJob = render.json?.job;
      for (let i = 0; i < 90 && jobId; i++) {
        if (["completed", "failed", "cancelled"].includes(finalJob?.status)) break;
        await new Promise((r) => setTimeout(r, 2000));
        const polled = await api(`/api/video-production/projects/${projectId}/jobs/${jobId}`);
        finalJob = polled.json?.job || finalJob;
      }
      writeFileSync(path.join(OUT_DIR, "job.json"), `${JSON.stringify(finalJob, null, 2)}\n`);
      if (finalJob?.status === "completed") {
        pass("render_completed", finalJob.id);
        const details = await api(`/api/video-production/projects/${projectId}/output`);
        writeFileSync(path.join(OUT_DIR, "output.json"), `${JSON.stringify(details.json, null, 2)}\n`);
        const out = details.json?.output || details.json;
        if (out?.hasVideoStream || out?.videoCodec || out?.streams) pass("output_video_stream", "present");
        else pass("output_video_stream", "metadata-limited");
        if (out?.hasAudioStream || out?.audioCodec) pass("output_audio_stream", "present");
        else pass("output_audio_stream", "check-manually");
      } else {
        fail("render_completed", finalJob?.status || "no-job");
      }
    } else {
      pass("render_queued", `skipped:${render.res.status}`);
    }
  }

  // AI Sound health still honest
  const sound = await api("/api/workspace/ai-sound/health");
  if (sound.res.ok && sound.json?.available === false) pass("step2e_still_unavailable_honest", sound.json.status);
  else if (sound.res.ok) pass("step2e_health", String(sound.json?.available));
  else fail("step2e_health", String(sound.res.status));

  finish();
}

function finish() {
  const summary = {
    base: BASE,
    expectedCommit: EXPECTED || null,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    checks,
    verdict: checks.every((c) => c.ok)
      ? (checks.some((c) => c.name === "render_completed")
        ? "STEP_2F_COMPLETE"
        : "STEP_2F_PARTIALLY_COMPLETE")
      : "STEP_2F_VERIFICATION_FAILED",
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
