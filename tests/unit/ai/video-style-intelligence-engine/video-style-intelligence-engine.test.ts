import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  CinematicStyleClass,
  StyleTemplatePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-style-test-"));
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
  visual: { sharpness: 85, visualStability: 85, saturation: 70, contrast: 75, dominantColors: ["#111", "#fff"] },
  frame: { frameConsistencyScore: 90, sceneChangeCandidates: 4, motionDensity: 58 },
  tags: ["test"],
  keywords: ["test"],
  creativeStyle: "modern",
  category: "technology",
};

async function runPipeline(
  f: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoIntelligenceFoundation"]>,
  videoId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await f.getVideoAnalysisEngine().analyzeVideo({
    ...baseInput,
    videoId,
    videoName: videoId,
    filePath: `uploads/${videoId}.mp4`,
    videoType: VideoAnalysisType.Commercial,
    product: "Product",
    brand: "KWIZERA",
    ...extra,
  });
  await f.getVideoUnderstandingEngine().understandVideo({ videoId });
  await f.getSceneDetectionEngine().detectScenes({ videoId });
  await f.getTimelineIntelligenceEngine().analyzeTimeline({ videoId });
  await f.getCameraMovementEngine().analyzeCamera({ videoId });
  await f.getMotionIntelligenceEngine().analyzeMotion({ videoId });
}

describe("AiVideoStyleIntelligenceEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as video-style-intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getVideoStyleIntelligenceEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("video-style-intelligence")
        ?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("analyzes style after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-style";

    await runPipeline(f, videoId);

    const result = await f.getVideoStyleIntelligenceEngine().analyzeStyle({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.profile.styleId).toBeTruthy();
    expect(result.record?.cinematicStyles.length).toBeGreaterThan(0);
    expect(result.record?.templates.length).toBeGreaterThan(0);
    expect(result.record?.scores.styleConsistencyScore).toBeGreaterThan(50);

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

    const result = await f.getVideoStyleIntelligenceEngine().analyzeStyle({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and cinematic style", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getVideoStyleIntelligenceEngine();

    for (const id of ["style-a", "style-b"]) {
      await runPipeline(f, id);
      await engine.analyzeStyle({ videoId: id });
    }

    expect(engine.searchStyleAnalysis({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(
      engine.searchStyleAnalysis({ style: CinematicStyleClass.Commercial }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      engine.searchStyleAnalysis({ platform: StyleTemplatePlatform.ProductAds }).length
    ).toBeGreaterThanOrEqual(1);
    await core.stop();
  });

  it("exposes style template library", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getVideoStyleIntelligenceEngine();
    expect(engine.templateLibrary.getAllTemplates().length).toBeGreaterThanOrEqual(8);
    await core.stop();
  });
});
