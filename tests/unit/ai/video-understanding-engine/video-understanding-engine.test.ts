import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  VideoUnderstandingMarketingGoal,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-understanding-test-"));
}

describe("AiVideoUnderstandingEngine", () => {
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
    await core.start("video-understanding-engine-test");

    const engine = core.getManager().videoIntelligenceFoundation!.getVideoUnderstandingEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const registered = core
      .getManager()
      .videoIntelligenceFoundation!.getRegistry()
      .getModule("video-understanding-engine");
    expect(registered?.implemented).toBe(true);

    await core.stop();
  });

  it("understands video after analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const analysisEngine = foundation.getVideoAnalysisEngine();
    const engine = foundation.getVideoUnderstandingEngine();

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
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { sharpness: 85, dominantColors: ["#000000", "#ffffff"] },
      tags: ["test"],
      keywords: ["commercial", "test"],
    });

    const result = await engine.understandVideo({
      videoId: "test-commercial",
      marketingGoal: VideoUnderstandingMarketingGoal.Conversion,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.videoUnderstandingScore).toBeGreaterThan(50);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.knowledgeGraph.nodes.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects understanding without prior analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().videoIntelligenceFoundation!.getVideoUnderstandingEngine();
    const result = await engine.understandVideo({ videoId: "nonexistent" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches understanding by brand and purpose", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const analysisEngine = foundation.getVideoAnalysisEngine();
    const engine = foundation.getVideoUnderstandingEngine();

    const baseInput = {
      fileFormat: VideoFileFormat.MP4,
      fileSizeBytes: 3_000_000,
      width: 1920,
      height: 1080,
      durationMs: 20_000,
      fps: 30,
      bitrateKbps: 6000,
      language: "en",
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { dominantColors: ["#111111"] },
      tags: ["test"],
    };

    await analysisEngine.analyzeVideo({
      ...baseInput,
      videoId: "search-a",
      videoName: "Brand A Video",
      filePath: "uploads/a.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "Product A",
      brand: "KWIZERA",
      keywords: ["kwizera"],
    });

    await analysisEngine.analyzeVideo({
      ...baseInput,
      videoId: "search-b",
      videoName: "Brand B Video",
      filePath: "uploads/b.mp4",
      width: 1280,
      height: 720,
      videoType: VideoAnalysisType.SocialMedia,
      product: "Product B",
      brand: "KWIZERA",
      keywords: ["social"],
    });

    await engine.understandVideo({ videoId: "search-a" });
    await engine.understandVideo({ videoId: "search-b" });

    const brandResults = engine.searchUnderstanding({ brand: "KWIZERA" });
    expect(brandResults.length).toBeGreaterThanOrEqual(2);

    const purposeResults = engine.searchUnderstanding({ videoPurpose: "Promote" });
    expect(purposeResults.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("keeps video understanding as second prepared module", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    expect(PREPARED_VIDEO_INTELLIGENCE_MODULES[1]?.moduleId).toBe("video-understanding-engine");

    await core.stop();
  });
});
