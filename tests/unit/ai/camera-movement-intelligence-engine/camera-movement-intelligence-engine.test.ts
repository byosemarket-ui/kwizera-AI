import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  VideoAnalysisType,
  VideoFileFormat,
  CameraMovementType,
  PREPARED_VIDEO_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-camera-movement-test-"));
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
  frame: { frameConsistencyScore: 90, sceneChangeCandidates: 4, motionDensity: 55 },
  tags: ["test"],
  keywords: ["test"],
};

describe("AiCameraMovementIntelligenceEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers as camera-intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const engine = core.getManager().videoIntelligenceFoundation!.getCameraMovementEngine();
    expect(engine.isStartupComplete()).toBe(true);
    expect(
      core.getManager().videoIntelligenceFoundation!.getRegistry().getModule("camera-intelligence")?.implemented
    ).toBe(true);
    await core.stop();
  });

  it("analyzes camera after full pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const videoId = "test-camera";

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

    const result = await f.getCameraMovementEngine().analyzeCamera({ videoId });
    expect(result.success).toBe(true);
    expect(result.record?.shotAnalyses.length).toBeGreaterThan(0);
    expect(result.record?.scores.cameraMovementScore).toBeGreaterThan(50);

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

    const result = await f.getCameraMovementEngine().analyzeCamera({ videoId });
    expect(result.success).toBe(false);
    await core.stop();
  });

  it("searches by brand and movement", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    const f = core.getManager().videoIntelligenceFoundation!;
    const engine = f.getCameraMovementEngine();

    for (const id of ["cam-a", "cam-b"]) {
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
      await engine.analyzeCamera({ videoId: id });
    }

    expect(engine.searchCameraAnalysis({ brand: "KWIZERA" }).length).toBeGreaterThanOrEqual(2);
    expect(engine.searchCameraAnalysis({ movement: CameraMovementType.ZoomIn }).length).toBeGreaterThanOrEqual(1);
    await core.stop();
  });

  it("keeps camera-intelligence as eighth prepared module", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();
    expect(PREPARED_VIDEO_INTELLIGENCE_MODULES[7]?.moduleId).toBe("camera-intelligence");
    await core.stop();
  });
});
