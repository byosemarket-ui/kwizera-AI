import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  TimelineVariant,
  TrackType,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-timeline-intelligence-test-"));
}

const baseVideoInput = {
  fileFormat: VideoFileFormat.MP4,
  fileSizeBytes: 5_000_000,
  width: 1920,
  height: 1080,
  durationMs: 30_000,
  fps: 30,
  bitrateKbps: 8000,
  language: "en",
  sceneCount: 4,
  shotCount: 8,
  creationDate: new Date().toISOString(),
  lastModifiedDate: new Date().toISOString(),
  visual: { sharpness: 85, visualStability: 80 },
  frame: { frameConsistencyScore: 90, sceneChangeCandidates: 4 },
  tags: ["test"],
  keywords: ["test"],
};

describe("AiTimelineIntelligenceEngine", () => {
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
    await core.start("timeline-intelligence-test");

    const engine = core.getManager().videoIntelligenceFoundation!.getTimelineIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const registered = core
      .getManager()
      .videoIntelligenceFoundation!.getRegistry()
      .getModule("timeline-intelligence");
    expect(registered?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes timeline after analysis and scene detection", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-timeline-commercial";

    await foundation.getVideoAnalysisEngine().analyzeVideo({
      ...baseVideoInput,
      videoId,
      videoName: "Test Commercial",
      filePath: "uploads/test.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "Test Product",
      brand: "TestBrand",
    });
    await foundation.getSceneDetectionEngine().detectScenes({ videoId });

    const result = await foundation.getTimelineIntelligenceEngine().analyzeTimeline({ videoId });

    expect(result.success).toBe(true);
    expect(result.record?.timelineId).toContain("timeline-");
    expect(result.record?.tracks.length).toBeGreaterThanOrEqual(8);
    expect(result.record?.variants.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.scores.timelineQualityScore).toBeGreaterThan(50);

    await core.stop();
  });

  it("rejects timeline without scene detection", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-no-scene";

    await foundation.getVideoAnalysisEngine().analyzeVideo({
      ...baseVideoInput,
      videoId,
      videoName: "No Scene",
      filePath: "uploads/no-scene.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "Product",
      brand: "Brand",
    });

    const result = await foundation.getTimelineIntelligenceEngine().analyzeTimeline({ videoId });
    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches timelines by brand and variant", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const engine = foundation.getTimelineIntelligenceEngine();

    for (const id of ["search-a", "search-b"]) {
      await foundation.getVideoAnalysisEngine().analyzeVideo({
        ...baseVideoInput,
        videoId: id,
        videoName: id,
        filePath: `uploads/${id}.mp4`,
        videoType: VideoAnalysisType.Commercial,
        product: "Product",
        brand: "KWIZERA",
      });
      await foundation.getSceneDetectionEngine().detectScenes({ videoId: id });
      await engine.analyzeTimeline({ videoId: id });
    }

    expect(engine.searchTimelines({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(engine.searchTimelines({ variant: TimelineVariant.Main }).length).toBeGreaterThanOrEqual(2);
    expect(engine.searchTimelines({ trackType: TrackType.Video }).length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("keeps timeline intelligence as fourth prepared module", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    expect(PREPARED_VIDEO_INTELLIGENCE_MODULES[3]?.moduleId).toBe("timeline-intelligence");

    await core.stop();
  });
});
