import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  CreativeVideoType,
  CreativeVideoTemplateType,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-creative-video-test-"));
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
}

describe("AiCreativeVideoIntelligenceEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as creative-video-intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getCreativeVideoIntelligenceEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("creative-video-intelligence")
        ?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("plans creative video after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-creative";

    await runPipeline(f, videoId);

    const result = await f.getCreativeVideoIntelligenceEngine().planCreativeVideo({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.storyboard.sceneOrder.length).toBeGreaterThanOrEqual(2);
    expect(result.record?.marketingPlan.ctaStrategy).toBeTruthy();
    expect(result.record?.templates.length).toBeGreaterThan(0);
    expect(result.record?.scores.creativeScore).toBeGreaterThan(50);

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

    const result = await f.getCreativeVideoIntelligenceEngine().planCreativeVideo({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and creative type", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getCreativeVideoIntelligenceEngine();

    for (const id of ["creative-a", "creative-b"]) {
      await runPipeline(f, id);
      await engine.planCreativeVideo({ videoId: id });
    }

    expect(engine.searchCreativePlans({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(
      engine.searchCreativePlans({ creativeType: CreativeVideoType.Commercial }).length
    ).toBeGreaterThanOrEqual(1);
    await core.stop();
  });

  it("exposes creative template library with 10 templates", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getCreativeVideoIntelligenceEngine();
    expect(engine.templateLibrary.getAllTemplates().length).toBe(10);
    expect(
      PREPARED_VIDEO_INTELLIGENCE_MODULES.some((m) => m.moduleId === "creative-video-intelligence")
    ).toBe(true);
    await core.stop();
  });
});
