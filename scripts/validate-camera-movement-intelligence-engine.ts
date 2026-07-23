import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  VideoAnalysisType,
  VideoCodec,
  AudioCodec,
  VideoContainer,
  VideoFileFormat,
  FrameRateMode,
  VideoColorSpace,
  CameraMovementType,
  CameraAngle,
  ShotFraming,
  type CameraMovementEngineStatusReport,
  type CameraMovementRecord,
} from "../ai/index.js";
import type { VideoAnalysisEngineInput } from "../ai/video-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-camera-movement-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_COMMERCIAL: VideoAnalysisEngineInput = {
  videoId: "step7f-kwizera-commercial",
  videoName: "KWIZERA Pro Studio Commercial",
  filePath: "uploads/kwizera-pro-commercial.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H264,
  audioCodec: AudioCodec.AAC,
  fileSizeBytes: 48_500_000,
  durationMs: 30_000,
  width: 1920,
  height: 1080,
  fps: 30,
  frameRateMode: FrameRateMode.Constant,
  bitrateKbps: 12_000,
  colorSpace: VideoColorSpace.Rec709,
  metadata: { campaign: "pro-launch-2026" },
  creationDate: "2026-01-20T10:00:00.000Z",
  lastModifiedDate: "2026-03-15T14:30:00.000Z",
  videoType: VideoAnalysisType.Commercial,
  product: "KWIZERA Pro Studio",
  brand: "KWIZERA",
  language: "en",
  sceneCount: 4,
  shotCount: 8,
  visual: { sharpness: 88, visualStability: 85 },
  frame: { frameConsistencyScore: 92, sceneChangeCandidates: 4, motionDensity: 58 },
  tags: ["commercial", "validation"],
  keywords: ["commercial", "kwizera"],
  campaign: "pro-launch-2026",
};

const SAMPLE_SOCIAL: VideoAnalysisEngineInput = {
  videoId: "step7f-kwizera-social-reel",
  videoName: "KWIZERA Social Reel",
  filePath: "uploads/kwizera-social-reel.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H264,
  audioCodec: AudioCodec.AAC,
  fileSizeBytes: 8_200_000,
  durationMs: 15_000,
  width: 1080,
  height: 1920,
  fps: 30,
  bitrateKbps: 4500,
  colorSpace: VideoColorSpace.SRGB,
  metadata: { platform: "instagram-reels" },
  creationDate: "2026-02-10T09:00:00.000Z",
  lastModifiedDate: "2026-02-10T09:00:00.000Z",
  videoType: VideoAnalysisType.SocialMedia,
  product: "KWIZERA Urban Collection",
  brand: "KWIZERA",
  language: "en",
  sceneCount: 3,
  shotCount: 6,
  visual: { sharpness: 80, visualStability: 78 },
  frame: { frameConsistencyScore: 88, sceneChangeCandidates: 3, motionDensity: 72 },
  tags: ["social", "validation"],
  keywords: ["reel", "social"],
};

const SAMPLE_TUTORIAL: VideoAnalysisEngineInput = {
  videoId: "step7f-kwizera-tutorial",
  videoName: "KWIZERA Studio Tutorial",
  filePath: "uploads/kwizera-studio-tutorial.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H265,
  audioCodec: AudioCodec.AAC,
  fileSizeBytes: 125_000_000,
  durationMs: 600_000,
  width: 1920,
  height: 1080,
  fps: 24,
  bitrateKbps: 16_000,
  colorSpace: VideoColorSpace.Rec709,
  metadata: { instructor: "KWIZERA Academy" },
  creationDate: "2026-03-01T08:00:00.000Z",
  lastModifiedDate: "2026-04-01T12:00:00.000Z",
  videoType: VideoAnalysisType.Tutorial,
  product: "KWIZERA Pro Studio",
  brand: "KWIZERA",
  language: "en",
  sceneCount: 12,
  shotCount: 24,
  visual: { sharpness: 82, visualStability: 88 },
  frame: { frameConsistencyScore: 90, sceneChangeCandidates: 12, motionDensity: 35 },
  tags: ["tutorial", "validation"],
  keywords: ["tutorial", "kwizera"],
};

async function runFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoIntelligenceFoundation"]>,
  input: VideoAnalysisEngineInput
): Promise<void> {
  const id = input.videoId!;
  await foundation.getVideoAnalysisEngine().analyzeVideo(input);
  await foundation.getVideoUnderstandingEngine().understandVideo({ videoId: id });
  await foundation.getSceneDetectionEngine().detectScenes({ videoId: id });
  await foundation.getTimelineIntelligenceEngine().analyzeTimeline({ videoId: id });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 7F Camera Movement Intelligence Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({
      storageRootOverride: storageRoot,
      skipReasoningEngine: true,
      skipDecisionEngine: true,
      skipPlanningEngine: true,
      skipWorkflowEngine: true,
      skipTaskManager: true,
    });
    await core.start("step-7f-validation");

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const engine = foundation.getCameraMovementEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Camera Movement Intelligence Engine operational",
    };

    await runFullPipeline(foundation, SAMPLE_COMMERCIAL);
    const start = Date.now();
    const commercial = await engine.analyzeCamera({ videoId: "step7f-kwizera-commercial" });
    const ms = Date.now() - start;

    results.cameraMovementDetection = {
      passed: commercial.success && (commercial.record?.detectedMovements.length ?? 0) >= 2,
      detail: `${commercial.record?.detectedMovements.length} movements in ${ms}ms, score ${commercial.record?.scores.cameraMovementScore}`,
    };

    results.cameraAngleDetection = {
      passed:
        commercial.record?.shotAnalyses.some((s) => s.angle === CameraAngle.EyeLevel) === true &&
        commercial.record?.shotAnalyses.length >= 3,
      detail: `Angles: ${[...new Set(commercial.record?.shotAnalyses.map((s) => s.angle))].join(", ")}`,
    };

    results.framingDetection = {
      passed:
        commercial.record?.shotAnalyses.some((s) => s.framing === ShotFraming.MediumShot || s.framing === ShotFraming.CloseUp) === true,
      detail: `Framings: ${[...new Set(commercial.record?.shotAnalyses.map((s) => s.framing))].join(", ")}`,
    };

    results.stabilityAnalysis = {
      passed: (commercial.record?.scores.stabilityScore ?? 0) >= 45,
      detail: `${commercial.record?.overallStability}, smoothness ${commercial.record?.motionSmoothness}`,
    };

    results.cinematicPlanning = {
      passed:
        Boolean(commercial.record?.movementPlan.recommendedPath) &&
        Boolean(commercial.record?.movementPlan.cinematicStyle),
      detail: `${commercial.record?.movementPlan.recommendedMovement} — ${commercial.record?.movementPlan.cinematicStyle}`,
    };

    results.productionReadiness = {
      passed: (commercial.record?.scores.productionReadinessScore ?? 0) >= 55,
      detail: `Production ${commercial.record?.scores.productionReadinessScore}, cinematic ${commercial.record?.scores.cinematicScore}`,
    };

    results.recommendationQuality = {
      passed: Array.isArray(commercial.record?.recommendations),
      detail: `${commercial.record?.recommendations.length ?? 0} recommendation(s)`,
    };

    results.relationshipDetection = {
      passed:
        (commercial.record?.relationships.relatedShots.length ?? 0) >= 3 &&
        (commercial.record?.relationships.relatedTimelines.length ?? 0) >= 1,
      detail: `${commercial.record?.relationships.relatedShots.length} shots, ${commercial.record?.relationships.relatedTimelines.length} timelines`,
    };

    await runFullPipeline(foundation, SAMPLE_SOCIAL);
    await runFullPipeline(foundation, SAMPLE_TUTORIAL);
    const social = await engine.analyzeCamera({ videoId: "step7f-kwizera-social-reel" });
    const tutorial = await engine.analyzeCamera({ videoId: "step7f-kwizera-tutorial" });

    results.multiVideoAnalysis = {
      passed: social.success && tutorial.success,
      detail: `Social ${social.record?.detectedMovements.length} movements, Tutorial ${tutorial.record?.shotAnalyses.length} shots`,
    };

    const noPipeline = await engine.analyzeCamera({ videoId: "step7f-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without prerequisites",
    };

    const repaired = await engine.repairCameraAnalysis("step7f-kwizera-social-reel");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Camera analysis repair verified" : "Repair failed",
    };

    const movementSearch = engine.searchCameraAnalysis({ movement: CameraMovementType.Gimbal });
    const brandSearch = engine.searchCameraAnalysis({ brand: "KWIZERA" });

    results.search = {
      passed: brandSearch.length >= 2,
      detail: `${brandSearch.length} by brand, ${movementSearch.length} gimbal movement(s)`,
    };

    const status = engine.buildStatusReport();
    results.knowledgeBridge = { passed: status.knowledgeBridgeStatus === "connected", detail: status.knowledgeBridgeStatus };
    results.memoryBridge = { passed: status.memoryBridgeStatus === "connected", detail: status.memoryBridgeStatus };
    results.productIntelligenceBridge = {
      passed: status.productIntelligenceBridgeStatus === "connected",
      detail: status.productIntelligenceBridgeStatus,
    };
    results.imageIntelligenceBridge = {
      passed: status.imageIntelligenceBridgeStatus === "connected",
      detail: status.imageIntelligenceBridgeStatus,
    };

    const logFile = path.join(
      storageRoot,
      "logs",
      `camera-movement-intelligence-engine-${new Date().toISOString().slice(0, 10)}.jsonl`
    );
    results.logging = { passed: fs.existsSync(logFile), detail: logFile };
    results.performance = {
      passed: status.performance.averageAnalysisMs < 120000,
      detail: `avg ${status.performance.averageAnalysisMs}ms, search ${status.performance.averageSearchMs}ms`,
    };
    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("camera-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.moduleName}, v${registered?.version}`,
    };

    await core.stop("step-7f-validation");
    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Camera-Movement-Report.md"),
      buildMovementReport(status, results, storageRoot, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Camera-Angles-Report.md"),
      buildAnglesReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Framing-Report.md"),
      buildFramingReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Cinematic-Planning-Report.md"),
      buildCinematicReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Camera-Readiness-Report.md"),
      buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-7F-VALIDATION-REPORT.md"),
      buildMovementReport(status, results, storageRoot, allPassed),
      "utf8"
    );

    console.log("Reports written:", projectStateDir);
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);

    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMovementReport(
  status: CameraMovementEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# Camera Movement Report — Step 7F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage:** \`${storageRoot}\``,
    `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
    `**Readiness:** ${status.readinessScore}/100`,
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(([k, r]) => `| ${k} | ${r.passed ? "✅" : "❌"} | ${r.detail} |`),
    "",
    `- Videos processed: ${status.videosProcessed}`,
    `- Shots analyzed: ${status.totalShotsAnalyzed}`,
    `- Avg movement score: ${status.averageCameraMovementScore}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 7F validation complete. Awaiting approval before Step 7G.",
    "",
  ].join("\n");
}

function buildAnglesReport(
  a: CameraMovementRecord | undefined,
  b: CameraMovementRecord | undefined,
  c: CameraMovementRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Camera Angles Report — Step 7F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Dominant Angle | Shot Angles |",
    "|-------|----------------|-------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.dominantAngle} | ${[...new Set(r!.shotAnalyses.map((s) => s.angle))].join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildFramingReport(
  a: CameraMovementRecord | undefined,
  b: CameraMovementRecord | undefined,
  c: CameraMovementRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Framing Report — Step 7F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Dominant Framing | Shot Framings |",
    "|-------|------------------|---------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.dominantFraming} | ${[...new Set(r!.shotAnalyses.map((s) => s.framing))].join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildCinematicReport(
  a: CameraMovementRecord | undefined,
  b: CameraMovementRecord | undefined,
  c: CameraMovementRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Cinematic Planning Report — Step 7F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Recommended Movement | Style | Continuity | Purposes |",
    "|-------|----------------------|-------|------------|----------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.movementPlan.recommendedMovement} | ${r!.movementPlan.cinematicStyle.slice(0, 40)} | ${r!.movementPlan.motionContinuity} | ${r!.cinematicPurposes.join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(
  status: CameraMovementEngineStatusReport,
  a: CameraMovementRecord | undefined,
  b: CameraMovementRecord | undefined,
  c: CameraMovementRecord | undefined,
  allPassed: boolean
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Camera Readiness Report — Step 7F",
    "",
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Video | Movement | Cinematic | Stability | Storytelling | Production | Confidence |",
    "|-------|----------|-----------|-----------|--------------|------------|------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.scores.cameraMovementScore} | ${r!.scores.cinematicScore} | ${r!.scores.stabilityScore} | ${r!.scores.storytellingScore} | ${r!.scores.productionReadinessScore} | ${r!.scores.aiConfidenceScore} |`
    ),
    "",
  ].join("\n");
}

void main();
