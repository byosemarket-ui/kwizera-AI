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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-optimization-test-"));
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
  await f.getVideoQualityPredictionEngine().predictVideoQuality({ videoId });
}

describe("AiVideoIntelligenceOptimizationEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as video-intelligence-optimization", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getVideoIntelligenceOptimizationEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("video-intelligence-optimization")
        ?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("runs optimization after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-optimization";

    await runPipeline(f, videoId);

    const result = await f.getVideoIntelligenceOptimizationEngine().runOptimization({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.moduleResults.length).toBe(11);
    expect(result.record?.moduleResults.every((m) => m.qualityScoreAfter >= m.qualityScoreBefore)).toBe(true);
    expect(result.record?.scores.overallImprovementScore).toBeGreaterThanOrEqual(5);
    expect(result.record?.recoveryPointId).toBeTruthy();
    expect(result.record?.productionReady).toBe(true);

    await core.stop();
  });

  it("rejects without quality prediction", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "no-quality";

    await f.getVideoAnalysisEngine().analyzeVideo({
      ...baseInput,
      videoId,
      videoName: "No Quality",
      filePath: "uploads/x.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "P",
      brand: "B",
    });

    const result = await f.getVideoIntelligenceOptimizationEngine().runOptimization({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and improvement score", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getVideoIntelligenceOptimizationEngine();

    for (const id of ["opt-a", "opt-b"]) {
      await runPipeline(f, id);
      await engine.runOptimization({ videoId: id });
    }

    expect(engine.searchOptimizations({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(engine.searchOptimizations({ minImprovementScore: 5 }).length).toBeGreaterThanOrEqual(2);
    await core.stop();
  });

  it("restores recovery point and validates cache", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "recovery-test";

    await runPipeline(f, videoId);
    const result = await f.getVideoIntelligenceOptimizationEngine().runOptimization({ videoId });

    expect(result.record?.cache.videos.length).toBeGreaterThanOrEqual(1);
    expect(f.getVideoIntelligenceOptimizationEngine().restoreRecoveryPoint(result.record!.recoveryPointId)).toBe(true);
    expect(
      PREPARED_VIDEO_INTELLIGENCE_MODULES.some((m) => m.moduleId === "video-intelligence-optimization")
    ).toBe(true);
    await core.stop();
  });
});
