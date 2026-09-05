import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  audioUserError,
  extractedAudioTitle,
  maxAudioBytes,
  normalizeAudioMime,
  normalizeProjectAudio,
  sanitizeAudioFileName,
} from "../../../../ai/creative-workspace/audio-asset.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import {
  ffmpegAvailable,
  ffprobeAvailable,
  muxAudioOntoVideo,
  probeAudio,
  probeVideo,
} from "../../../../ai/video-production/ffmpeg-renderer.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function makeWav(filePath: string, durationSec = 1.5, freq = 440): Promise<Buffer> {
  // Generate a minimal PCM WAV via ffmpeg when available; otherwise write a tiny valid WAV header+silence.
  const hasFfmpeg = await ffmpegAvailable();
  if (hasFfmpeg) {
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${durationSec}`,
      "-ac", "1", "-ar", "44100", filePath,
    ], { timeout: 30_000, windowsHide: true });
    return fs.readFile(filePath);
  }
  const sampleRate = 44100;
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
  await fs.writeFile(filePath, buf);
  return buf;
}

async function makeSilentMp4(filePath: string, durationSec = 1): Promise<void> {
  const hasFfmpeg = await ffmpegAvailable();
  if (!hasFfmpeg) throw new Error("ffmpeg required");
  await execFileAsync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", `color=c=black:s=320x240:d=${durationSec}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", filePath,
  ], { timeout: 60_000, windowsHide: true });
}

async function makeMp4WithAudio(filePath: string, durationSec = 1.2): Promise<void> {
  const hasFfmpeg = await ffmpegAvailable();
  if (!hasFfmpeg) throw new Error("ffmpeg required");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", `color=c=blue:s=320x240:d=${durationSec}`,
    "-f", "lavfi", "-i", `sine=frequency=880:duration=${durationSec}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest",
    filePath,
  ], { timeout: 60_000, windowsHide: true });
}

describe("STEP 2B audio asset helpers", () => {
  it("normalizes supported MIME types and rejects unknown", () => {
    expect(normalizeAudioMime("audio/mpeg")).toBe("audio/mpeg");
    expect(normalizeAudioMime("audio/mp3")).toBe("audio/mpeg");
    expect(normalizeAudioMime("audio/x-wav")).toBe("audio/wav");
    expect(normalizeAudioMime("audio/x-m4a")).toBe("audio/mp4");
    expect(normalizeAudioMime("", "track.ogg")).toBe("audio/ogg");
    expect(normalizeAudioMime("application/octet-stream", "x.bin")).toBeNull();
  });

  it("sanitizes filenames and builds extracted titles", () => {
    expect(sanitizeAudioFileName("../evil/../../song.mp3", "mp3")).toBe("song.mp3");
    expect(extractedAudioTitle("Promo Clip.mp4")).toBe("Promo Clip — Extracted Audio");
  });

  it("normalizes project audio selection defaults", () => {
    expect(normalizeProjectAudio(null)).toEqual({
      selectedAudioAssetId: null,
      enabled: false,
      volume: 1,
    });
    expect(normalizeProjectAudio({ selectedAudioAssetId: "a1", enabled: true, volume: 2 })).toEqual({
      selectedAudioAssetId: "a1",
      enabled: true,
      volume: 1,
    });
  });

  it("maps user-facing error messages", () => {
    expect(audioUserError("NO_AUDIO_STREAM", "x")).toBe("No audio stream was found in this video.");
    expect(audioUserError("UNSUPPORTED_FORMAT", "x")).toBe("This audio format is not supported.");
    expect(maxAudioBytes()).toBeGreaterThanOrEqual(10 * 1024 * 1024);
  });
});

describe("STEP 2B audio library + project selection", () => {
  let root: string;
  let workspace: CreativeWorkspaceManager;
  let projectA: string;
  let projectB: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step2b-"));
    workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    projectA = (await workspace.createProject("Project A")).id;
    projectB = (await workspace.createProject("Project B")).id;
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("rejects zero-byte and unsupported audio", async () => {
    await expect(workspace.uploadAudio(projectA, {
      fileName: "empty.mp3",
      mimeType: "audio/mpeg",
      dataBase64: Buffer.alloc(0).toString("base64"),
    })).rejects.toMatchObject({ code: "EMPTY_FILE" });

    await expect(workspace.uploadAudio(projectA, {
      fileName: "x.xyz",
      mimeType: "audio/xyz",
      dataBase64: Buffer.from("not-audio").toString("base64"),
    })).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("rejects corrupt audio that cannot be decoded", async () => {
    const hasProbe = await ffprobeAvailable();
    if (!hasProbe) return;
    await expect(workspace.uploadAudio(projectA, {
      fileName: "song.mp3",
      mimeType: "audio/mpeg",
      dataBase64: Buffer.from("this is not a real mp3 file!!!!").toString("base64"),
    })).rejects.toMatchObject({ code: expect.stringMatching(/CORRUPT|DECODE|UNSUPPORTED/) });
  });

  it("uploads audio, probes metadata, persists library, and reuses by SHA-256", async () => {
    const hasProbe = await ffprobeAvailable();
    if (!hasProbe) return;

    const wavPath = path.join(root, "tone.wav");
    const bytes = await makeWav(wavPath, 1.2);
    const hash = createHash("sha256").update(bytes).digest("hex");

    const first = await workspace.uploadAudio(projectA, {
      fileName: "audio.mp3",
      mimeType: "audio/wav",
      dataBase64: bytes.toString("base64"),
    });
    expect(first.reused).toBe(false);
    expect(first.audio.status).toBe("READY");
    expect(first.audio.contentHash).toBe(hash);
    expect(first.audio.durationMs).toBeGreaterThan(500);
    expect(first.audio.metadata.codec).toBeTruthy();
    expect(first.audio.playbackUrl).toContain("/api/workspace/audio-library/");

    const second = await workspace.uploadAudio(projectA, {
      fileName: "my-beat-copy.wav",
      mimeType: "audio/wav",
      dataBase64: bytes.toString("base64"),
    });
    expect(second.reused).toBe(true);
    expect(second.audio.assetId).toBe(first.audio.assetId);

    const different = await makeWav(path.join(root, "other.wav"), 1.0, 220);
    const third = await workspace.uploadAudio(projectA, {
      fileName: "audio.mp3",
      mimeType: "audio/wav",
      dataBase64: different.toString("base64"),
    });
    expect(third.reused).toBe(false);
    expect(third.audio.assetId).not.toBe(first.audio.assetId);

    const lib = await workspace.listAudioLibrary();
    expect(lib.length).toBeGreaterThanOrEqual(2);
    expect(lib.some((a) => a.assetId === first.audio.assetId)).toBe(true);

    const filePath = await workspace.getAudioFilePath(first.audio.assetId);
    expect(filePath).toBeTruthy();
    const probed = await probeAudio(filePath!);
    expect(probed.hasAudioStream).toBe(true);
  });

  it("selects/clears project audio with A/B isolation and keeps library on remove", async () => {
    const hasProbe = await ffprobeAvailable();
    if (!hasProbe) return;

    const aBytes = await makeWav(path.join(root, "a.wav"), 1.0, 440);
    const bBytes = await makeWav(path.join(root, "b.wav"), 1.0, 330);
    const audioA = await workspace.uploadAudio(projectA, {
      fileName: "a.wav", mimeType: "audio/wav", dataBase64: aBytes.toString("base64"),
    });
    const audioB = await workspace.uploadAudio(projectB, {
      fileName: "b.wav", mimeType: "audio/wav", dataBase64: bBytes.toString("base64"),
    });

    await workspace.selectProjectAudio(projectA, audioA.audio.assetId);
    await workspace.selectProjectAudio(projectB, audioB.audio.assetId);

    const projA = await workspace.getProject(projectA);
    const projB = await workspace.getProject(projectB);
    expect(projA?.selectedAudioAssetId).toBe(audioA.audio.assetId);
    expect(projB?.selectedAudioAssetId).toBe(audioB.audio.assetId);
    expect(workspace.getProjectAudioSelection(projA!).enabled).toBe(true);

    await workspace.clearProjectAudio(projectA);
    const cleared = await workspace.getProject(projectA);
    expect(cleared?.selectedAudioAssetId).toBeNull();
    expect(cleared?.audioEnabled).toBe(false);

    const stillThere = await workspace.getAudioAsset(audioA.audio.assetId);
    expect(stillThere?.status).toBe("READY");

    await expect(workspace.deleteAudioAsset(audioB.audio.assetId)).rejects.toMatchObject({ code: "ASSET_IN_USE" });
    await workspace.clearProjectAudio(projectB);
    await workspace.deleteAudioAsset(audioB.audio.assetId);
    expect(await workspace.getAudioAsset(audioB.audio.assetId)).toBeNull();
  });

  it("extracts audio from video and rejects no-audio video", async () => {
    const hasFfmpeg = await ffmpegAvailable();
    if (!hasFfmpeg) return;

    const withAudio = path.join(root, "with-audio.mp4");
    const noAudio = path.join(root, "no-audio.mp4");
    await makeMp4WithAudio(withAudio, 1.1);
    await makeSilentMp4(noAudio, 1.0);

    const extracted = await workspace.extractAudioFromUploadedVideo(projectA, {
      fileName: "demo-clip.mp4",
      mimeType: "video/mp4",
      dataBase64: (await fs.readFile(withAudio)).toString("base64"),
    });
    expect(extracted.audio.sourceType).toBe("EXTRACTED_FROM_VIDEO");
    expect(extracted.audio.title).toContain("Extracted Audio");
    expect(extracted.audio.durationMs).toBeGreaterThan(400);
    expect(extracted.audio.status).toBe("READY");

    await expect(workspace.extractAudioFromUploadedVideo(projectA, {
      fileName: "silent.mp4",
      mimeType: "video/mp4",
      dataBase64: (await fs.readFile(noAudio)).toString("base64"),
    })).rejects.toMatchObject({ code: "NO_AUDIO_STREAM" });

    const lib = await workspace.listAudioLibrary({ sourceType: "EXTRACTED_FROM_VIDEO" });
    expect(lib.some((a) => a.assetId === extracted.audio.assetId)).toBe(true);
  });

  it("muxes selected audio onto a silent video with audio stream", async () => {
    const hasFfmpeg = await ffmpegAvailable();
    if (!hasFfmpeg) return;

    const videoPath = path.join(root, "silent.mp4");
    const audioPath = path.join(root, "bed.wav");
    const outPath = path.join(root, "muxed.mp4");
    await makeSilentMp4(videoPath, 1.5);
    await makeWav(audioPath, 3.0);
    const silent = await probeVideo(videoPath);
    expect(silent.hasAudioStream).toBeFalsy();

    const muxed = await muxAudioOntoVideo({
      videoPath,
      audioPath,
      outputPath: outPath,
      videoDurationMs: silent.durationMs,
      volume: 0.8,
    });
    expect(muxed.hasAudioStream).toBe(true);
    expect(muxed.durationMs).toBeGreaterThan(500);
  });
});
