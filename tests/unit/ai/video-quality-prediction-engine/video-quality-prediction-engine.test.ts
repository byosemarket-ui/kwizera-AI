import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  VideoQualityPredictionPlatform,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-quality-test-"));
}

const baseInput = {
  fileFormat: VideoFileFormat.MP4,
  fileSizeBytes: 5_000_000,
  width: 1920,
  height: 1080,
  durationMs: 30_000,
  fps: 30,
  sceneCount: 4,
  shotCount: 8,
  visual: { sharpness: 85, visualStability: 85, saturation: 70, contrast: 75, noise: 20 },
  frame: { frameConsistencyScore: 90, motionDensity: 58 },
  keywords: ["test"],
  creativeStyle: "modern",
  category: "technology",
};

async function runPipeline(
  f: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoIntelligenceFoundation"]>,
  videoId: string
): Promise<void> {
  await f.getVideoAnalysisEngine().analyzeVideo({
    ...baseInput,
    videoId,
    videoName: videoId,
    filePath: `uploads/${videoId}.mp4`,
    videoType: VideoAnalysisType.Commercial,
    product: "Product",
    brand: "KWIZERA",
  });
  await f.getVideoUnderstandingEngine().understandVideo({ videoId });
  await f.getSceneDetectionEngine().detectScenes({ videoId });
  await f.getTimelineIntelligenceEngine().analyzeTimeline({ videoId });
  await f.getCameraMovementEngine().analyzeCamera({ videoId });
  await f.getMotionIntelligenceEngine().analyzeMotion({ videoId });
  await f.getVideoStyleIntelligenceEngine().analyzeStyle({ videoId });
  await f.getVideoEnhancementPlanningEngine().planEnhancement({ videoId });
  await f.getCreativeVideoIntelligenceEngine().planCreativeVideo({ videoId });
  await f.getProductionVideoPlanningEngine().planProductionVideo({ videoId });
}

describe("AiVideoQualityPredictionEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as video-quality-prediction", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getVideoQualityPredictionEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("video-quality-prediction")
        ?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("predicts quality after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-quality-prediction";

    await runPipeline(f, videoId);

    const result = await f.getVideoQualityPredictionEngine().predictVideoQuality({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.checks.dependencyValidation).toBe(true);
    expect(result.record?.scores.overallVideoQualityScore).toBeGreaterThan(45);
    expect(result.record?.predictions.productionSuccessProbability).toBeGreaterThan(0);
    expect(result.record?.highestRiskLevel).not.toBe("critical");
    expect(result.record?.productionReady).toBe(true);

    await core.stop();
  });

  it("rejects without production plan", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "no-production";

    await f.getVideoAnalysisEngine().analyzeVideo({
      ...baseInput,
      videoId,
      videoName: "No Production",
      filePath: "uploads/x.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "P",
      brand: "B",
    });

    const result = await f.getVideoQualityPredictionEngine().predictVideoQuality({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and quality score", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getVideoQualityPredictionEngine();

    for (const id of ["vq-a", "vq-b"]) {
      await runPipeline(f, id);
      await engine.predictVideoQuality({ videoId: id });
    }

    expect(engine.searchQualityPredictions({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(engine.searchQualityPredictions({ minQualityScore: 50 }).length).toBeGreaterThanOrEqual(2);
    await core.stop();
  });

  it("evaluates platform quality for all platforms", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "platform-test";

    await runPipeline(f, videoId);
    const result = await f.getVideoQualityPredictionEngine().predictVideoQuality({
      videoId,
      platform: VideoQualityPredictionPlatform.YouTube,
    });

    expect(result.record?.platformQuality.length).toBe(8);
    expect(result.record?.risks.length).toBeGreaterThanOrEqual(0);
    expect(result.record?.recommendations.length).toBeGreaterThanOrEqual(5);
    expect(
      PREPARED_VIDEO_INTELLIGENCE_MODULES.some((m) => m.moduleId === "video-quality-prediction")
    ).toBe(true);
    await core.stop();
  });
});
