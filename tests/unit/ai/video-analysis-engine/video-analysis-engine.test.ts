import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-analysis-test-"));
}

describe("AiVideoAnalysisEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes and registers with video intelligence foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("video-analysis-engine-test");

    const engine = core.getManager().videoIntelligenceFoundation!.getVideoAnalysisEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const registered = core
      .getManager()
      .videoIntelligenceFoundation!.getRegistry()
      .getModule("video-analysis-engine");
    expect(registered?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes video and stores intelligence record", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().videoIntelligenceFoundation!.getVideoAnalysisEngine();
    const result = await engine.analyzeVideo({
      videoId: "test-commercial",
      videoName: "Test Commercial",
      filePath: "uploads/test-commercial.mp4",
      fileFormat: VideoFileFormat.MP4,
      fileSizeBytes: 5_000_000,
      width: 1920,
      height: 1080,
      durationMs: 30_000,
      fps: 30,
      bitrateKbps: 8000,
      videoType: VideoAnalysisType.Commercial,
      product: "Test Product",
      brand: "TestBrand",
      language: "en",
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { sharpness: 85, dominantColors: ["#000000", "#ffffff"] },
      tags: ["test"],
      keywords: ["commercial", "test"],
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.videoCompletenessScore).toBeGreaterThan(50);
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects incomplete video analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().videoIntelligenceFoundation!.getVideoAnalysisEngine();
    const result = await engine.analyzeVideo({ videoId: "incomplete", videoName: "Incomplete" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches videos by brand and resolution", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().videoIntelligenceFoundation!.getVideoAnalysisEngine();

    await engine.analyzeVideo({
      videoId: "search-a",
      videoName: "Brand A Video",
      filePath: "uploads/a.mp4",
      fileFormat: VideoFileFormat.MP4,
      fileSizeBytes: 3_000_000,
      width: 1920,
      height: 1080,
      durationMs: 20_000,
      fps: 30,
      bitrateKbps: 6000,
      videoType: VideoAnalysisType.Commercial,
      product: "Product A",
      brand: "KWIZERA",
      language: "en",
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { dominantColors: ["#111111"] },
      tags: ["test"],
      keywords: ["kwizera"],
    });

    await engine.analyzeVideo({
      videoId: "search-b",
      videoName: "Brand B Video",
      filePath: "uploads/b.mp4",
      fileFormat: VideoFileFormat.MP4,
      fileSizeBytes: 4_000_000,
      width: 1280,
      height: 720,
      durationMs: 15_000,
      fps: 24,
      bitrateKbps: 4000,
      videoType: VideoAnalysisType.SocialMedia,
      product: "Product B",
      brand: "KWIZERA",
      language: "en",
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { dominantColors: ["#222222"] },
      tags: ["test"],
      keywords: ["social"],
    });

    const brandResults = engine.searchVideos({ brand: "KWIZERA" });
    expect(brandResults.length).toBeGreaterThanOrEqual(2);

    const resolutionResults = engine.searchVideos({ resolution: "1920x1080" });
    expect(resolutionResults.some((r) => r.videoId === "search-a")).toBe(true);

    await core.stop();
  });

  it("keeps video analysis as first prepared module", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    expect(PREPARED_VIDEO_INTELLIGENCE_MODULES[0]?.moduleId).toBe("video-analysis-engine");

    await core.stop();
  });
});
