import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MonitoredVideoIntelligenceModule,
  VideoAnalysisType,
  VideoCodec,
  AudioCodec,
  VideoContainer,
  VideoFileFormat,
  VideoQualityPredictionPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-vi-health-monitor-test-"));
}

const ANALYSIS_SAMPLE = {
  videoId: "vihm-test-commercial",
  videoName: "VI Health Monitor Test Commercial",
  filePath: "uploads/test-commercial.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H264,
  audioCodec: AudioCodec.AAC,
  durationMs: 30_000,
  width: 1920,
  height: 1080,
  fps: 30,
  videoType: VideoAnalysisType.Commercial,
  product: "Test Product",
  brand: "TestBrand",
  sceneCount: 3,
  shotCount: 6,
  visual: { sharpness: 85, visualStability: 80, saturation: 70, contrast: 75, noise: 15 },
  frame: { frameConsistencyScore: 90, motionDensity: 55 },
  category: "technology",
  creativeStyle: "commercial",
  keywords: ["test"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoIntelligenceFoundation"]>
): Promise<void> {
  const videoId = "vihm-test-commercial";
  await foundation.getVideoAnalysisEngine().analyzeVideo(ANALYSIS_SAMPLE);
  await foundation.getVideoUnderstandingEngine().understandVideo({ videoId });
  await foundation.getSceneDetectionEngine().detectScenes({ videoId });
  await foundation.getTimelineIntelligenceEngine().analyzeTimeline({ videoId });
  await foundation.getCameraMovementEngine().analyzeCamera({ videoId });
  await foundation.getMotionIntelligenceEngine().analyzeMotion({ videoId });
  await foundation.getVideoStyleIntelligenceEngine().analyzeStyle({ videoId });
  await foundation.getVideoEnhancementPlanningEngine().planEnhancement({ videoId });
  await foundation.getCreativeVideoIntelligenceEngine().planCreativeVideo({ videoId });
  await foundation.getProductionVideoPlanningEngine().planProductionVideo({ videoId });
  await foundation.getVideoQualityPredictionEngine().predictVideoQuality({
    videoId,
    projectId: "vihm-test",
    platform: VideoQualityPredictionPlatform.Website,
  });
  await foundation.getVideoIntelligenceOptimizationEngine().runOptimization({ videoId });
}

describe("AiVideoIntelligenceHealthMonitorEngine", () => {
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
    await core.start("vi-health-monitor-test");

    const engine = core.getManager().videoIntelligenceFoundation!.getVideoIntelligenceHealthMonitorEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .videoIntelligenceFoundation!.getRegistry()
      .getModule("video-intelligence-health-monitor");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("runs health check after full video intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const check = await foundation.getVideoIntelligenceHealthMonitorEngine().runHealthCheck();

    expect(check.overallScore).toBeGreaterThanOrEqual(75);
    expect(check.moduleScores.length).toBeGreaterThanOrEqual(19);
    expect(
      check.moduleScores.find((m) => m.module === MonitoredVideoIntelligenceModule.VideoAnalysis)
    ).toBeTruthy();

    await core.stop();
  });

  it("runs audit and generates reports", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const monitor = foundation.getVideoIntelligenceHealthMonitorEngine();
    await monitor.runHealthCheck();
    const audit = await monitor.runAudit();
    const paths = monitor.generateReports();

    expect(audit.valid).toBe(true);
    expect(fs.existsSync(paths.healthReportPath)).toBe(true);
    expect(fs.existsSync(paths.historyReportPath)).toBe(true);
    expect(monitor.getHealthHistory().length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("detects simulated corruption warnings", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const analysisPath = path.join(
      foundation.getVideoAnalysisEngine().getEngineDir(),
      "video-analysis-records.json"
    );
    const backup = fs.readFileSync(analysisPath, "utf8");
    fs.writeFileSync(analysisPath, "{ corrupted", "utf8");

    const check = await foundation.getVideoIntelligenceHealthMonitorEngine().runHealthCheck();
    expect(check.warnings.length > 0 || check.errors.length > 0).toBe(true);

    fs.writeFileSync(analysisPath, backup, "utf8");
    await core.stop();
  });
});
