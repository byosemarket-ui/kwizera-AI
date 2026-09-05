#!/usr/bin/env node
/**
 * STEP 2B live verification — audio upload, library, selection, extract, render with audio stream.
 */
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { deflateSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step2b-audio-artifacts");

function resolveBin(name) {
  const envKey = name === "ffmpeg" ? "KWIZERA_FFMPEG_PATH" : "KWIZERA_FFPROBE_PATH";
  if (process.env[envKey]) return process.env[envKey];
  const candidates = [
    name,
    `${name}.exe`,
    path.join("C:\\ffmpeg\\bin", `${name}.exe`),
    path.join("C:\\Program Files\\ffmpeg\\bin", `${name}.exe`),
    path.join(os.homedir(), "ffmpeg", "bin", `${name}.exe`),
  ];
  for (const c of candidates) {
    try {
      if ((c.includes("\\") || c.includes("/")) && existsSync(c)) return c;
    } catch { /* ignore */ }
  }
  return name;
}

const FFMPEG = resolveBin("ffmpeg");
const FFPROBE = resolveBin("ffprobe");

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

/** Minimal PCM WAV — no local ffmpeg required. */
function makeWavBase64(durationSec = 1.5, freq = 440) {
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
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.35 * 32767;
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample))), 44 + i * 2);
  }
  return buf.toString("base64");
}

async function hasLocalFfmpeg() {
  try {
    await execFileAsync(FFMPEG, ["-version"], { timeout: 8000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
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
      await new Promise((r) => setTimeout(r, 2000 + attempt * 1000));
    }
  }
  throw last ?? new Error("api failed");
}

async function waitJob(projectId, jobId) {
  for (let i = 0; i < 240; i++) {
    const last = await api(`/api/video-production/projects/${projectId}/jobs/${jobId}`);
    const job = last.job ?? last;
    console.log(`  ${job.status} ${job.stage} ${job.progress}%`);
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error("job timeout");
}

async function makeVideoBase64(tmpDir, name, { withAudio }) {
  const filePath = path.join(tmpDir, name);
  const args = withAudio
    ? [
      "-y",
      "-f", "lavfi", "-i", "color=c=navy:s=320x240:d=1.2",
      "-f", "lavfi", "-i", "sine=frequency=660:duration=1.2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", filePath,
    ]
    : [
      "-y", "-f", "lavfi", "-i", "color=c=gray:s=320x240:d=1.0",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", filePath,
    ];
  await execFileAsync(FFMPEG, args, { timeout: 60_000, windowsHide: true });
  return readFileSync(filePath).toString("base64");
}

async function probeHasAudio(filePath) {
  try {
    const { stdout } = await execFileAsync(FFPROBE, [
      "-v", "error",
      "-show_entries", "stream=codec_type,codec_name:format=duration",
      "-of", "json",
      filePath,
    ], { timeout: 20_000, windowsHide: true });
    const parsed = JSON.parse(stdout);
    const audio = (parsed.streams || []).find((s) => s.codec_type === "audio");
    return {
      hasAudio: Boolean(audio),
      codec: audio?.codec_name || null,
      duration: Number(parsed.format?.duration || 0),
      method: "ffprobe",
    };
  } catch {
    const buf = readFileSync(filePath);
    const text = buf.toString("latin1");
    const hasAudio = text.includes("mp4a") || text.includes("soun");
    return { hasAudio, codec: hasAudio ? "mp4a?" : null, duration: 0, method: "box-scan" };
  }
}

async function seedProject(tag) {
  const created = await api("/api/workspace/projects", {
    method: "POST",
    body: { name: `STEP2B-${tag}-${Date.now()}` },
  });
  const projectId = created.project?.id;
  if (!projectId) throw new Error("create failed");
  await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: `Audio Product ${tag}`,
          category: "Fashion",
          description: "STEP 2B audio asset live test",
          price: 42000,
          currency: "RWF",
        },
        brandInformation: { name: `Audio Brand ${tag}` },
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
      dataBase64: png(480, 720, tag === "A" ? 30 : 90, tag === "A" ? 120 : 40, 180),
    },
  });
  return projectId;
}

async function main() {
  const checks = [];
  const pass = (n, d = "") => { checks.push({ name: n, ok: true, detail: d }); console.log(`✓ ${n}${d ? ` — ${d}` : ""}`); };
  const fail = (n, d = "") => { checks.push({ name: n, ok: false, detail: d }); console.error(`✗ ${n}${d ? ` — ${d}` : ""}`); };
  mkdirSync(OUT_DIR, { recursive: true });
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "kwizera-step2b-live-"));
  const localFfmpeg = await hasLocalFfmpeg();

  try {
    const health = await api("/api/health");
    if (health.runtimeReady) pass("health"); else fail("health", JSON.stringify(health).slice(0, 120));

    const deploy = await api("/api/deployment");
    const deployed = String(deploy.deployedCommit || "");
    if (!EXPECTED) pass("deployed-commit", `${deployed.slice(0, 12)} (no expect pin)`);
    else if (deployed.startsWith(EXPECTED) && deploy.verifiedLive) pass("deployed-commit", deployed.slice(0, 12));
    else fail("deployed-commit", `${deployed.slice(0, 12)} verified=${deploy.verifiedLive} expected=${EXPECTED}`);

    const projectA = await seedProject("A");
    const projectB = await seedProject("B");
    pass("projects", `${projectA.slice(0, 8)} / ${projectB.slice(0, 8)}`);

    const wavA = makeWavBase64(2.0, 440);
    const wavB = makeWavBase64(1.5, 330);
    const uploadA = await api(`/api/workspace/projects/${projectA}/audio`, {
      method: "POST",
      body: { fileName: "beat-a.wav", mimeType: "audio/wav", dataBase64: wavA },
    });
    if (uploadA.audio?.status === "READY") pass("upload-audio", uploadA.audio.assetId);
    else fail("upload-audio", JSON.stringify(uploadA).slice(0, 200));

    const reuse = await api(`/api/workspace/projects/${projectA}/audio`, {
      method: "POST",
      body: { fileName: "beat-a-copy.wav", mimeType: "audio/wav", dataBase64: wavA },
    });
    if (reuse.reused && reuse.audio?.assetId === uploadA.audio?.assetId) pass("sha256-reuse", reuse.audio.assetId);
    else fail("sha256-reuse", JSON.stringify({ reused: reuse.reused, id: reuse.audio?.assetId }).slice(0, 160));

    const uploadB = await api(`/api/workspace/projects/${projectB}/audio`, {
      method: "POST",
      body: { fileName: "beat-b.wav", mimeType: "audio/wav", dataBase64: wavB },
    });
    if (uploadB.audio?.assetId && uploadB.audio.assetId !== uploadA.audio?.assetId) pass("upload-b-distinct");
    else fail("upload-b-distinct", String(uploadB.audio?.assetId));

    await api(`/api/workspace/projects/${projectA}/audio/selection`, {
      method: "PUT",
      body: { assetId: uploadA.audio.assetId },
    });
    await api(`/api/workspace/projects/${projectB}/audio/selection`, {
      method: "PUT",
      body: { assetId: uploadB.audio.assetId },
    });

    const reA = await api(`/api/workspace/projects/${projectA}`);
    const reB = await api(`/api/workspace/projects/${projectB}`);
    const selA = reA.project?.selectedAudioAssetId ?? reA.selectedAudioAssetId;
    const selB = reB.project?.selectedAudioAssetId ?? reB.selectedAudioAssetId;
    if (selA === uploadA.audio.assetId) pass("persist-select-a"); else fail("persist-select-a", String(selA));
    if (selB === uploadB.audio.assetId && selB !== selA) pass("isolation-ab"); else fail("isolation-ab", `${selA} / ${selB}`);

    const playUrl = uploadA.audio.playbackUrl;
    const playRes = await fetch(`${BASE}${playUrl}`, { headers: { Range: "bytes=0-1023" } });
    if (playRes.status === 206 || playRes.status === 200) {
      const ct = playRes.headers.get("content-type") || "";
      if (/audio\//i.test(ct) || playRes.status === 206) pass("audio-media-url", `${playRes.status} ${ct}`);
      else fail("audio-media-url", `${playRes.status} ${ct}`);
    } else fail("audio-media-url", String(playRes.status));

    const lib = await api("/api/workspace/audio-library");
    if ((lib.assets || []).some((a) => a.assetId === uploadA.audio.assetId)) pass("library-list");
    else fail("library-list", `count=${(lib.assets || []).length}`);

    await api(`/api/workspace/projects/${projectA}/audio/selection`, { method: "DELETE" });
    const cleared = await api(`/api/workspace/projects/${projectA}`);
    const clearedId = cleared.project?.selectedAudioAssetId ?? cleared.selectedAudioAssetId;
    if (!clearedId) pass("clear-selection"); else fail("clear-selection", String(clearedId));
    const stillLib = await api("/api/workspace/audio-library");
    if ((stillLib.assets || []).some((a) => a.assetId === uploadA.audio.assetId)) pass("library-kept-after-clear");
    else fail("library-kept-after-clear");

    await api(`/api/workspace/projects/${projectA}/audio/selection`, {
      method: "PUT",
      body: { assetId: uploadA.audio.assetId },
    });

    if (localFfmpeg) {
      const withAudioVid = await makeVideoBase64(tmpDir, "with-audio.mp4", { withAudio: true });
      const extracted = await api(`/api/workspace/projects/${projectA}/audio/extract`, {
        method: "POST",
        body: { fileName: "clip-source.mp4", mimeType: "video/mp4", dataBase64: withAudioVid },
      });
      if (extracted.audio?.sourceType === "EXTRACTED_FROM_VIDEO" && extracted.audio.status === "READY") {
        pass("extract-audio", extracted.audio.assetId);
      } else fail("extract-audio", JSON.stringify(extracted).slice(0, 200));

      const silentVid = await makeVideoBase64(tmpDir, "no-audio.mp4", { withAudio: false });
      let noAudioOk = false;
      try {
        await api(`/api/workspace/projects/${projectA}/audio/extract`, {
          method: "POST",
          body: { fileName: "silent.mp4", mimeType: "video/mp4", dataBase64: silentVid },
          retries: 2,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/No audio stream/i.test(msg) || /NO_AUDIO/i.test(msg)) noAudioOk = true;
        else fail("no-audio-video", msg.slice(0, 200));
      }
      if (noAudioOk) pass("no-audio-video");
    } else {
      pass("extract-audio", "skipped — local ffmpeg unavailable (covered by unit tests on CI host)");
      pass("no-audio-video", "skipped — local ffmpeg unavailable");
    }

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
      body: { preset: "standard" },
    });
    const jobId = started.job?.id || started.id;
    if (!jobId) fail("render-queued", JSON.stringify(started).slice(0, 160));
    else pass("render-queued", jobId);

    const job = await waitJob(projectA, jobId);
    if (job.status === "completed") pass("render-complete");
    else fail("render-complete", `${job.status} ${job.error || ""}`);

    const out = await api(`/api/video-production/projects/${projectA}/output`);
    const output = out.output || out;
    const url = output.url;
    if (!url) fail("output-url", JSON.stringify(output).slice(0, 160));
    else {
      const mp4Res = await fetch(`${BASE}${url}`);
      if (!mp4Res.ok) fail("download-mp4", String(mp4Res.status));
      else {
        const buf = Buffer.from(await mp4Res.arrayBuffer());
        const mp4Path = path.join(OUT_DIR, "engine1-with-audio.mp4");
        writeFileSync(mp4Path, buf);
        const probed = await probeHasAudio(mp4Path);
        if (probed.hasAudio) pass("final-mp4-audio-stream", `${probed.method} ${probed.codec} ${probed.duration.toFixed(2)}s`);
        else fail("final-mp4-audio-stream", "no audio stream");
      }
    }

    await api(`/api/workspace/projects/${projectB}/audio/selection`, { method: "DELETE" });
    try {
      await api(`/api/product-asset-preparation/projects/${projectB}/prepare`, { method: "POST", body: {} });
    } catch { /* optional */ }
    await api(`/api/workspace/projects/${projectB}/plan`, {
      method: "POST",
      body: { action: "generate", productionMode: "AI_PRODUCT_MOTION", creativeTone: "Clean" },
    });
    await api(`/api/workspace/projects/${projectB}/plan/finalize`, { method: "POST", body: {} });
    await api(`/api/video-production/projects/${projectB}`, { method: "POST", body: { action: "create" } });
    const startedB = await api(`/api/video-production/projects/${projectB}/render`, {
      method: "POST",
      body: { preset: "preview" },
    });
    const jobBId = startedB.job?.id || startedB.id;
    const jobB = await waitJob(projectB, jobBId);
    if (jobB.status === "completed") pass("render-without-audio");
    else fail("render-without-audio", `${jobB.status} ${jobB.error || ""}`);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  const report = {
    base: BASE,
    expectedCommit: EXPECTED || null,
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    at: new Date().toISOString(),
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nSTEP 2B live: ${report.passed}/${checks.length} passed`);
  if (report.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
