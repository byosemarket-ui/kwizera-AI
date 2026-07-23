import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  VideoEnhancementPlatform,
  EnhancementType,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-enhancement-test-"));
}

const baseInput = {
  fileFormat: VideoFileFormat.MP4,
  fileSizeBytes: 5_000_000,
  width: 1920,
  height: 1080,
  durationMs: 30_000,
  fps: 30,
  bitrateKbps: 8000,
  sceneCount: 4,
  shotCount: 8,
  visual: { sharpness: 82, visualStability: 85, saturation: 70, contrast: 75, noise: 20, brightness: 70, exposure: 72, whiteBalance: 78 },
  frame: { frameConsistencyScore: 90, motionDensity: 58 },
  keywords: ["test"],
  creativeStyle: "modern",
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
}

describe("AiVideoEnhancementPlanningEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as video-enhancement-planning", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getVideoEnhancementPlanningEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("video-enhancement-planning")
        ?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("plans enhancement after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-enhance";

    await runPipeline(f, videoId);

    const result = await f.getVideoEnhancementPlanningEngine().planEnhancement({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.profile.enhancementPlanId).toBeTruthy();
    expect(result.record?.platformOptimizations.length).toBeGreaterThanOrEqual(8);
    expect(result.record?.nonDestructive.preserveOriginal).toBe(true);
    expect(result.record?.scores.enhancementReadinessScore).toBeGreaterThan(50);

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

    const result = await f.getVideoEnhancementPlanningEngine().planEnhancement({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and enhancement type", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getVideoEnhancementPlanningEngine();

    for (const id of ["enh-a", "enh-b"]) {
      await runPipeline(f, id);
      await engine.planEnhancement({ videoId: id });
    }

    expect(engine.searchEnhancementPlans({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(
      engine.searchEnhancementPlans({ enhancementType: EnhancementType.Platform }).length
    ).toBeGreaterThanOrEqual(1);
    await core.stop();
  });

  it("keeps video-enhancement-planning in prepared modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const slot = PREPARED_VIDEO_INTELLIGENCE_MODULES.find(
      (m) => m.moduleId === "video-enhancement-planning"
    );
    expect(slot?.moduleName).toBe("Video Enhancement Planning");
    await core.stop();
  });
});
