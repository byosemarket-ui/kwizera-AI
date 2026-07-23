import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  MotionClassification,
  ObjectMotionType,
  MotionEventType,
  TrackingSubjectType,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-motion-intelligence-test-"));
}

const baseInput = {
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
  visual: { sharpness: 85, visualStability: 85 },
  frame: { frameConsistencyScore: 90, sceneChangeCandidates: 4, motionDensity: 58 },
  tags: ["test"],
  keywords: ["test"],
};

describe("AiMotionIntelligenceEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as motion-intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getMotionIntelligenceEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("motion-intelligence")
        ?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("analyzes motion after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-motion";

    await f.getVideoAnalysisEngine().analyzeVideo({
      ...baseInput,
      videoId,
      videoName: "Test",
      filePath: "uploads/test.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "Product",
      brand: "Brand",
    });
    await f.getSceneDetectionEngine().detectScenes({ videoId });
    await f.getTimelineIntelligenceEngine().analyzeTimeline({ videoId });
    await f.getCameraMovementEngine().analyzeCamera({ videoId });

    const result = await f.getMotionIntelligenceEngine().analyzeMotion({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.subjectTracks.length).toBeGreaterThan(0);
    expect(result.record?.motionEvents.length).toBeGreaterThanOrEqual(2);
    expect(result.record?.scores.motionQualityScore).toBeGreaterThan(50);

    await core.stop();
  });

  it("rejects without scene detection", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "no-scene";

    await f.getVideoAnalysisEngine().analyzeVideo({
      ...baseInput,
      videoId,
      videoName: "No Scene",
      filePath: "uploads/x.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "P",
      brand: "B",
    });

    const result = await f.getMotionIntelligenceEngine().analyzeMotion({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and classification", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getMotionIntelligenceEngine();

    for (const id of ["motion-a", "motion-b"]) {
      await f.getVideoAnalysisEngine().analyzeVideo({
        ...baseInput,
        videoId: id,
        videoName: id,
        filePath: `uploads/${id}.mp4`,
        videoType: VideoAnalysisType.Commercial,
        product: "P",
        brand: "KWIZERA",
      });
      await f.getSceneDetectionEngine().detectScenes({ videoId: id });
      await f.getTimelineIntelligenceEngine().analyzeTimeline({ videoId: id });
      await f.getCameraMovementEngine().analyzeCamera({ videoId: id });
      await engine.analyzeMotion({ videoId: id });
    }

    expect(engine.searchMotionAnalysis({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(
      engine.searchMotionAnalysis({ classification: MotionClassification.PromotionalMotion }).length
    ).toBeGreaterThanOrEqual(1);
    await core.stop();
  });

  it("keeps motion-intelligence as seventh prepared module", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    expect(PREPARED_VIDEO_INTELLIGENCE_MODULES[6]?.moduleId).toBe("motion-intelligence");
    await core.stop();
  });
});
