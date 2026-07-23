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
  MotionClassification,
  MotionEventType,
  ObjectMotionType,
  TrackingSubjectType,
  type MotionIntelligenceEngineStatusReport,
  type MotionIntelligenceRecord,
} from "../ai/index.js";
import type { VideoAnalysisEngineInput } from "../ai/video-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-motion-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_COMMERCIAL: VideoAnalysisEngineInput = {
  videoId: "step7g-kwizera-commercial",
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
  videoId: "step7g-kwizera-social-reel",
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
  videoId: "step7g-kwizera-tutorial",
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
  await foundation.getCameraMovementEngine().analyzeCamera({ videoId: id });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 7G Motion Intelligence Engine Validation");
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
    await core.start("step-7g-validation");

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const engine = foundation.getMotionIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Motion Intelligence Engine operational",
    };

    await runFullPipeline(foundation, SAMPLE_COMMERCIAL);
    const start = Date.now();
    const commercial = await engine.analyzeMotion({ videoId: "step7g-kwizera-commercial" });
    const ms = Date.now() - start;

    results.motionDetection = {
      passed: commercial.success && commercial.record?.metrics.presence === true,
      detail: `Presence ${commercial.record?.metrics.presence}, density ${commercial.record?.metrics.density}, ${ms}ms`,
    };

    results.objectTracking = {
      passed:
        (commercial.record?.subjectTracks.length ?? 0) >= 1 &&
        (commercial.record?.objectMotions.length ?? 0) >= 2,
      detail: `${commercial.record?.subjectTracks.length} tracks, ${commercial.record?.objectMotions.length} object motions`,
    };

    results.motionClassification = {
      passed:
        (commercial.record?.classifications.length ?? 0) >= 2 &&
        commercial.record?.dominantClassification !== undefined,
      detail: `Dominant: ${commercial.record?.dominantClassification}, types: ${commercial.record?.classifications.join(", ")}`,
    };

    results.motionEvents = {
      passed: (commercial.record?.motionEvents.length ?? 0) >= 3,
      detail: `${commercial.record?.motionEvents.length} events`,
    };

    results.motionPlanning = {
      passed:
        Boolean(commercial.record?.motionPlan.motionPath) &&
        (commercial.record?.motionPlan.motionTimeline.length ?? 0) >= 2,
      detail: `${commercial.record?.motionPlan.motionTimeline.length} segments, continuity ${commercial.record?.motionPlan.motionContinuity}`,
    };

    results.productionReadiness = {
      passed: (commercial.record?.scores.productionReadinessScore ?? 0) >= 55,
      detail: `Quality ${commercial.record?.scores.motionQualityScore}, production ${commercial.record?.scores.productionReadinessScore}`,
    };

    results.recommendationQuality = {
      passed: (commercial.record?.recommendations.length ?? 0) >= 1,
      detail: `${commercial.record?.recommendations.length} recommendation(s)`,
    };

    results.relationshipDetection = {
      passed:
        (commercial.record?.relationships.relatedShots.length ?? 0) >= 3 &&
        (commercial.record?.relationships.relatedCameraMovements.length ?? 0) >= 1,
      detail: `${commercial.record?.relationships.relatedShots.length} shots, ${commercial.record?.relationships.relatedCameraMovements.length} camera links`,
    };

    await runFullPipeline(foundation, SAMPLE_SOCIAL);
    await runFullPipeline(foundation, SAMPLE_TUTORIAL);
    const social = await engine.analyzeMotion({ videoId: "step7g-kwizera-social-reel" });
    const tutorial = await engine.analyzeMotion({ videoId: "step7g-kwizera-tutorial" });

    results.multiVideoAnalysis = {
      passed: social.success && tutorial.success,
      detail: `Social ${social.record?.dominantClassification}, Tutorial ${tutorial.record?.subjectTracks.length} tracks`,
    };

    const noPipeline = await engine.analyzeMotion({ videoId: "step7g-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without prerequisites",
    };

    const repaired = await engine.repairMotionAnalysis("step7g-kwizera-social-reel");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Motion analysis repair verified" : "Repair failed",
    };

    const brandSearch = engine.searchMotionAnalysis({ brand: "KWIZERA" });
    const productSearch = engine.searchMotionAnalysis({
      objectType: ObjectMotionType.ProductMovement,
    });
    const eventSearch = engine.searchMotionAnalysis({
      eventType: MotionEventType.AttentionShift,
    });

    results.search = {
      passed: brandSearch.length >= 2 && productSearch.length >= 1,
      detail: `${brandSearch.length} by brand, ${productSearch.length} product motion, ${eventSearch.length} attention events`,
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
      `motion-intelligence-engine-${new Date().toISOString().slice(0, 10)}.jsonl`
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

    const registered = foundation.getRegistry().getModule("motion-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.moduleName}, v${registered?.version}`,
    };

    await core.stop("step-7g-validation");
    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Motion-Analysis-Report.md"),
      buildAnalysisReport(status, results, storageRoot, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Motion-Tracking-Report.md"),
      buildTrackingReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Motion-Planning-Report.md"),
      buildPlanningReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Motion-Quality-Report.md"),
      buildQualityReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Motion-Readiness-Report.md"),
      buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-7G-VALIDATION-REPORT.md"),
      buildAnalysisReport(status, results, storageRoot, allPassed),
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

function buildAnalysisReport(
  status: MotionIntelligenceEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# Motion Analysis Report — Step 7G",
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
    `- Total tracks: ${status.totalTracks}`,
    `- Total events: ${status.totalEvents}`,
    `- Avg motion quality: ${status.averageMotionQualityScore}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 7G validation complete. Awaiting approval before Step 7H.",
    "",
  ].join("\n");
}

function buildTrackingReport(
  a: MotionIntelligenceRecord | undefined,
  b: MotionIntelligenceRecord | undefined,
  c: MotionIntelligenceRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Motion Tracking Report — Step 7G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Tracks | Object Motions | Entry | Exit | Reappear |",
    "|-------|--------|----------------|-------|------|----------|",
    ...rows.map((r) => {
      const t = r!.subjectTracks[0];
      return `| ${r!.videoId} | ${r!.subjectTracks.length} | ${r!.objectMotions.length} | ${t?.entryDetected ?? "—"} | ${t?.exitDetected ?? "—"} | ${t?.reappearanceDetected ?? "—"} |`;
    }),
    "",
    "| Video | Subject Types |",
    "|-------|---------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${[...new Set(r!.subjectTracks.map((t) => t.subjectType))].join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildPlanningReport(
  a: MotionIntelligenceRecord | undefined,
  b: MotionIntelligenceRecord | undefined,
  c: MotionIntelligenceRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Motion Planning Report — Step 7G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Classification | Timeline Segments | Continuity | Blueprint |",
    "|-------|----------------|-------------------|------------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.dominantClassification} | ${r!.motionPlan.motionTimeline.length} | ${r!.motionPlan.motionContinuity} | ${r!.motionPlan.aiMotionBlueprint.slice(0, 50)}... |`
    ),
    "",
  ].join("\n");
}

function buildQualityReport(
  a: MotionIntelligenceRecord | undefined,
  b: MotionIntelligenceRecord | undefined,
  c: MotionIntelligenceRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Motion Quality Report — Step 7G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Quality | Stability | Tracking | Cinematic | Production | Confidence |",
    "|-------|---------|-----------|----------|-----------|------------|------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.scores.motionQualityScore} | ${r!.scores.motionStabilityScore} | ${r!.scores.trackingAccuracyScore} | ${r!.scores.cinematicMotionScore} | ${r!.scores.productionReadinessScore} | ${r!.scores.aiConfidenceScore} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(
  status: MotionIntelligenceEngineStatusReport,
  a: MotionIntelligenceRecord | undefined,
  b: MotionIntelligenceRecord | undefined,
  c: MotionIntelligenceRecord | undefined,
  allPassed: boolean
): string {
  return [
    "# Motion Readiness Report — Step 7G",
    "",
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    `**Videos Processed:** ${status.videosProcessed}`,
    `**Average Tracking Accuracy:** ${status.averageTrackingAccuracyScore}`,
    "",
    buildQualityReport(a, b, c),
  ].join("\n");
}

void main();
