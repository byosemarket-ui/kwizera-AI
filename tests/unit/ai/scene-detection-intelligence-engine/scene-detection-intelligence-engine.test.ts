import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  SceneClassification,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-scene-detection-test-"));
}

describe("AiSceneDetectionIntelligenceEngine", () => {
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
    await core.start("scene-detection-test");

    const engine = core.getManager().videoIntelligenceFoundation!.getSceneDetectionEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const registered = core
      .getManager()
      .videoIntelligenceFoundation!.getRegistry()
      .getModule("scene-intelligence");
    expect(registered?.implemented).toBe(true);

    await core.stop();
  });

  it("detects scenes after video analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const analysisEngine = foundation.getVideoAnalysisEngine();
    const engine = foundation.getSceneDetectionEngine();

    await analysisEngine.analyzeVideo({
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
      sceneCount: 4,
      shotCount: 8,
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { sharpness: 85, dominantColors: ["#000000"] },
      frame: { frameConsistencyScore: 90, sceneChangeCandidates: 4 },
      tags: ["test"],
      keywords: ["commercial"],
    });

    const result = await engine.detectScenes({ videoId: "test-commercial" });

    expect(result.success).toBe(true);
    expect(result.record?.sceneCount).toBeGreaterThanOrEqual(3);
    expect(result.record?.scores.sceneDetectionScore).toBeGreaterThan(50);
    expect(result.record?.indexes.sceneIndexIds.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects detection without prior analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().videoIntelligenceFoundation!.getSceneDetectionEngine();
    const result = await engine.detectScenes({ videoId: "nonexistent" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches detections by brand and scene type", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const analysisEngine = foundation.getVideoAnalysisEngine();
    const engine = foundation.getSceneDetectionEngine();

    const base = {
      fileFormat: VideoFileFormat.MP4,
      fileSizeBytes: 3_000_000,
      width: 1920,
      height: 1080,
      durationMs: 20_000,
      fps: 30,
      bitrateKbps: 6000,
      language: "en",
      sceneCount: 4,
      shotCount: 6,
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { sharpness: 80 },
      frame: { frameConsistencyScore: 88, sceneChangeCandidates: 4 },
      tags: ["test"],
    };

    await analysisEngine.analyzeVideo({
      ...base,
      videoId: "search-a",
      videoName: "Brand A Video",
      filePath: "uploads/a.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "Product A",
      brand: "KWIZERA",
      keywords: ["kwizera"],
    });

    await analysisEngine.analyzeVideo({
      ...base,
      videoId: "search-b",
      videoName: "Brand B Video",
      filePath: "uploads/b.mp4",
      videoType: VideoAnalysisType.SocialMedia,
      product: "Product B",
      brand: "KWIZERA",
      keywords: ["social"],
    });

    await engine.detectScenes({ videoId: "search-a" });
    await engine.detectScenes({ videoId: "search-b" });

    const brandResults = engine.searchDetections({ brand: "KWIZERA" });
    expect(brandResults.length).toBeGreaterThanOrEqual(2);

    const hookResults = engine.searchDetections({ sceneType: SceneClassification.Hook });
    expect(hookResults.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("keeps scene intelligence as third prepared module", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    expect(PREPARED_VIDEO_INTELLIGENCE_MODULES[2]?.moduleId).toBe("scene-intelligence");

    await core.stop();
  });
});
