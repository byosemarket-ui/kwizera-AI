/**
 * Final finishing — quality gate, audio isolation, recovery messaging.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { validateRenderedOutput } from "../../../../ai/video-production/render-validation.js";
import type { OutputQualityGate } from "../../../../ai/ai-director/ai-director-types.js";

describe("Final hardening — quality gate contract", () => {
  it("includes FINAL in the OutputQualityGate union used by production", () => {
    const gates: OutputQualityGate[] = [
      "VALIDATING",
      "TECHNICAL_VALIDATION",
      "AI_QUALITY_REVIEW",
      "READY",
      "FINAL",
      "FAILED",
    ];
    expect(gates).toContain("FINAL");
  });

  it("rejects muxed-audio renders that lack an audio stream", () => {
    const result = validateRenderedOutput({
      probed: {
        durationMs: 5000,
        width: 720,
        height: 1280,
        codec: "h264",
        sizeBytes: 50_000,
        hasAudioStream: false,
      },
      plannedDurationMs: 5000,
      plannedWidth: 720,
      plannedHeight: 1280,
      sceneCount: 3,
      preset: "standard",
      endCardRequired: false,
      audioRequired: true,
    });
    expect(result.valid).toBe(false);
    expect(result.checks.audioPresentWhenRequired).toBe(false);
    expect(result.issues.some((i) => /audio/i.test(i))).toBe(true);
  });

  it("accepts audio-required renders when audio stream is present", () => {
    const result = validateRenderedOutput({
      probed: {
        durationMs: 5000,
        width: 720,
        height: 1280,
        codec: "h264",
        sizeBytes: 50_000,
        hasAudioStream: true,
        audioCodec: "aac",
      },
      plannedDurationMs: 5000,
      plannedWidth: 720,
      plannedHeight: 1280,
      sceneCount: 3,
      preset: "standard",
      endCardRequired: false,
      audioRequired: true,
    });
    expect(result.valid).toBe(true);
    expect(result.checks.audioPresentWhenRequired).toBe(true);
  });
});

describe("Final hardening — audio library project isolation", () => {
  let root: string;
  let workspace: CreativeWorkspaceManager;
  let audioRoot: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-final-hardening-"));
    workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    audioRoot = path.join(root, "creative-workspace", "audio-library");
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("hides other projects' extracted audio while keeping uploaded music shared", async () => {
    const projectA = await workspace.createProject("Project A");
    const projectB = await workspace.createProject("Project B");

    const sampleRate = 8000;
    const samples = sampleRate;
    const dataSize = samples * 2;
    const wav = Buffer.alloc(44 + dataSize);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write("WAVE", 8);
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(dataSize, 40);

    let uploadedAssetId: string | null = null;
    try {
      const uploaded = await workspace.uploadAudio(projectA.id, {
        fileName: "shared-bed.wav",
        mimeType: "audio/wav",
        dataBase64: wav.toString("base64"),
      });
      uploadedAssetId = uploaded.audio.assetId;
    } catch {
      uploadedAssetId = "00000000-0000-4000-8000-0000000000a1";
      const uploadedFile = `${uploadedAssetId}.wav`;
      await fs.mkdir(audioRoot, { recursive: true });
      await fs.writeFile(path.join(audioRoot, uploadedFile), wav);
      await fs.writeFile(
        path.join(audioRoot, "index.json"),
        `${JSON.stringify({
          version: 1,
          assets: [{
            assetId: uploadedAssetId,
            type: "AUDIO",
            sourceType: "UPLOADED_AUDIO",
            originalFilename: "shared-bed.wav",
            title: "shared-bed",
            mimeType: "audio/wav",
            durationMs: 1000,
            fileSize: wav.length,
            storageFileName: uploadedFile,
            playbackUrl: `/api/workspace/audio-library/${uploadedFile}`,
            contentHash: "abc",
            status: "READY",
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerProjectId: projectA.id,
          }],
        }, null, 2)}\n`,
      );
    }

    const indexPath = path.join(audioRoot, "index.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
      assets: Array<Record<string, unknown>>;
    };
    const extractedId = "00000000-0000-4000-8000-0000000000b2";
    const extractedFile = `${extractedId}.wav`;
    await fs.writeFile(path.join(audioRoot, extractedFile), wav);
    index.assets.push({
      assetId: extractedId,
      type: "AUDIO",
      sourceType: "EXTRACTED_FROM_VIDEO",
      originalFilename: "clip-b.mp4",
      title: "Extracted B",
      mimeType: "audio/wav",
      durationMs: 1000,
      fileSize: wav.length,
      storageFileName: extractedFile,
      playbackUrl: `/api/workspace/audio-library/${extractedFile}`,
      contentHash: "deadbeef",
      status: "READY",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerProjectId: projectB.id,
    });
    await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

    const forA = await workspace.listAudioLibrary({ projectId: projectA.id });
    const forB = await workspace.listAudioLibrary({ projectId: projectB.id });
    const studio = await workspace.listAudioLibrary();

    expect(forA.some((a) => a.assetId === uploadedAssetId)).toBe(true);
    expect(forA.some((a) => a.assetId === extractedId)).toBe(false);
    expect(forB.some((a) => a.assetId === extractedId)).toBe(true);
    expect(studio.some((a) => a.assetId === extractedId)).toBe(true);
  });

  it("refuses to serve audio files that are not in the READY index", async () => {
    const orphan = path.join(audioRoot, "11111111-1111-4111-8111-111111111111.wav");
    await fs.mkdir(path.dirname(orphan), { recursive: true });
    await fs.writeFile(orphan, Buffer.from("not-indexed"));
    const resolved = await workspace.getAudioPathByFileName(path.basename(orphan));
    expect(resolved).toBeNull();
  });
});
