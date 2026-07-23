import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  ProductionVideoPlatform,
  ProductionVideoWorkflowStep,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-production-video-test-"));
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
}

describe("AiProductionVideoPlanningEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as production-video-planning", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getProductionVideoPlanningEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("production-video-planning")
        ?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("plans production video after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-production";

    await runPipeline(f, videoId);

    const result = await f.getProductionVideoPlanningEngine().planProductionVideo({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.dependencies.allRequiredPassed).toBe(true);
    expect(result.record?.renderPreparation.resolution).toBeTruthy();
    expect(result.record?.exportPreparation.mp4).toBeTruthy();
    expect(result.record?.scores.productionReadinessScore).toBeGreaterThan(55);
    expect(result.record?.productionReady).toBe(true);

    await core.stop();
  });

  it("rejects without creative plan", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "no-creative";

    await f.getVideoAnalysisEngine().analyzeVideo({
      ...baseInput,
      videoId,
      videoName: "No Creative",
      filePath: "uploads/x.mp4",
      videoType: VideoAnalysisType.Commercial,
      product: "P",
      brand: "B",
    });

    const result = await f.getProductionVideoPlanningEngine().planProductionVideo({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getProductionVideoPlanningEngine();

    for (const id of ["prod-a", "prod-b"]) {
      await runPipeline(f, id);
      await engine.planProductionVideo({ videoId: id });
    }

    expect(engine.searchProductionPlans({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(
      engine.searchProductionPlans({ workflow: ProductionVideoWorkflowStep.RenderingPreparation }).length
    ).toBeGreaterThanOrEqual(1);
    await core.stop();
  });

  it("validates export formats architecture", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "export-test";

    await runPipeline(f, videoId);
    const result = await f.getProductionVideoPlanningEngine().planProductionVideo({
      videoId,
      platform: ProductionVideoPlatform.YouTube,
    });

    expect(result.record?.exportPreparation.mp4).toBeTruthy();
    expect(result.record?.exportPreparation.mov).toBeTruthy();
    expect(result.record?.exportPreparation.mkv).toBeTruthy();
    expect(result.record?.exportPreparation.webm).toBeTruthy();
    expect(result.record?.exportPreparation.gif).toBeTruthy();
    expect(result.record?.exportPreparation.additionalFormatsSupported).toBe(true);
    expect(
      PREPARED_VIDEO_INTELLIGENCE_MODULES.some((m) => m.moduleId === "production-video-planning")
    ).toBe(true);
    await core.stop();
  });
});
