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
  SceneClassification,
  TransitionType,
  type SceneDetectionEngineStatusReport,
  type SceneDetectionRecord,
} from "../ai/index.js";
import type { VideoAnalysisEngineInput } from "../ai/video-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-scene-detection-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_COMMERCIAL: VideoAnalysisEngineInput = {
  videoId: "step7d-kwizera-commercial",
  videoName: "KWIZERA Pro Studio Commercial",
  filePath: "uploads/kwizera-pro-commercial.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H264,
  videoCodecProfile: "high",
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
  category: "marketing",
  creativeStyle: "commercial",
  language: "en",
  sceneCount: 4,
  shotCount: 8,
  visual: { sharpness: 88, dominantColors: ["#1a1a2e", "#e94560"], visualStability: 85, motionDensity: 58 },
  frame: { frameConsistencyScore: 92, missingFrames: 0, sceneChangeCandidates: 4 },
  tags: ["commercial", "validation"],
  keywords: ["commercial", "kwizera"],
  campaign: "pro-launch-2026",
};

const SAMPLE_SOCIAL: VideoAnalysisEngineInput = {
  videoId: "step7d-kwizera-social-reel",
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
  category: "social",
  language: "en",
  sceneCount: 3,
  shotCount: 6,
  visual: { sharpness: 80, motionDensity: 72, visualStability: 78 },
  frame: { frameConsistencyScore: 88, sceneChangeCandidates: 3 },
  tags: ["social", "validation"],
  keywords: ["reel", "social"],
};

const SAMPLE_TUTORIAL: VideoAnalysisEngineInput = {
  videoId: "step7d-kwizera-tutorial",
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
  category: "education",
  language: "en",
  sceneCount: 12,
  shotCount: 24,
  visual: { sharpness: 82, visualStability: 88 },
  frame: { frameConsistencyScore: 90, sceneChangeCandidates: 12 },
  tags: ["tutorial", "validation"],
  keywords: ["tutorial", "kwizera"],
};

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 7D Scene Detection Intelligence Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("Project state:", projectStateDir);
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
    await core.start("step-7d-validation");

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const analysisEngine = foundation.getVideoAnalysisEngine();
    const understandingEngine = foundation.getVideoUnderstandingEngine();
    const engine = foundation.getSceneDetectionEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Scene Detection Intelligence Engine operational",
    };

    await analysisEngine.analyzeVideo(SAMPLE_COMMERCIAL);
    await understandingEngine.understandVideo({ videoId: "step7d-kwizera-commercial" });

    const detectStart = Date.now();
    const commercial = await engine.detectScenes({ videoId: "step7d-kwizera-commercial" });
    const detectMs = Date.now() - detectStart;

    results.sceneDetection = {
      passed: commercial.success && (commercial.record?.sceneCount ?? 0) >= 3,
      detail: `${commercial.record?.sceneCount} scenes detected in ${detectMs}ms, score ${commercial.record?.scores.sceneDetectionScore}`,
    };

    results.shotDetection = {
      passed: (commercial.record?.shotCount ?? 0) >= 4,
      detail: `${commercial.record?.shotCount} shots, score ${commercial.record?.scores.shotDetectionScore}`,
    };

    results.transitionDetection = {
      passed:
        (commercial.record?.transitionCount ?? 0) >= 2 &&
        (commercial.record?.transitions.some((t) => t.type === TransitionType.Fade) ?? false),
      detail: `${commercial.record?.transitionCount} transitions, score ${commercial.record?.scores.transitionScore}`,
    };

    results.sceneClassification = {
      passed:
        commercial.record?.scenes.some((s) => s.classification === SceneClassification.Intro) === true &&
        commercial.record?.scenes.some((s) => s.classification === SceneClassification.Hook) === true,
      detail: commercial.record?.scenes.map((s) => s.classification).join(", "),
    };

    results.timelineAccuracy = {
      passed: (commercial.record?.scores.timelineAccuracyScore ?? 0) >= 50,
      detail: `Timeline accuracy ${commercial.record?.scores.timelineAccuracyScore}, length ${commercial.record?.timelineLengthMs}ms`,
    };

    results.indexCreation = {
      passed:
        (commercial.record?.indexes.sceneIndexIds.length ?? 0) >= 3 &&
        (commercial.record?.indexes.timelineIndexIds.length ?? 0) >= 1,
      detail: `Scenes ${commercial.record?.indexes.sceneIndexIds.length}, shots ${commercial.record?.indexes.shotIndexIds.length}, keyframes ${commercial.record?.indexes.keyframeIndexIds.length}`,
    };

    results.relationshipDetection = {
      passed: (commercial.record?.sceneRelationships.length ?? 0) >= 3,
      detail: `${commercial.record?.sceneRelationships.length} scene relationship maps`,
    };

    results.recommendationQuality = {
      passed: Array.isArray(commercial.record?.recommendations),
      detail: `${commercial.record?.recommendations.length ?? 0} recommendation(s)`,
    };

    await analysisEngine.analyzeVideo(SAMPLE_SOCIAL);
    await analysisEngine.analyzeVideo(SAMPLE_TUTORIAL);
    await understandingEngine.understandVideo({ videoId: "step7d-kwizera-social-reel" });
    await understandingEngine.understandVideo({ videoId: "step7d-kwizera-tutorial" });

    const social = await engine.detectScenes({ videoId: "step7d-kwizera-social-reel" });
    const tutorial = await engine.detectScenes({ videoId: "step7d-kwizera-tutorial" });

    results.multiVideoDetection = {
      passed: social.success && tutorial.success,
      detail: `Social ${social.record?.sceneCount} scenes, Tutorial ${tutorial.record?.sceneCount} scenes`,
    };

    const noAnalysis = await engine.detectScenes({ videoId: "step7d-nonexistent" });
    results.incompleteRejection = {
      passed: !noAnalysis.success,
      detail: noAnalysis.message ?? "Rejected without analysis",
    };

    const repaired = await engine.repairDetection("step7d-kwizera-social-reel");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Scene detection repair verified" : "Repair failed",
    };

    const brandSearch = engine.searchDetections({ brand: "KWIZERA" });
    results.search = {
      passed: brandSearch.length >= 2,
      detail: `${brandSearch.length} result(s) by brand`,
    };

    const sceneTypeSearch = engine.searchDetections({ sceneType: SceneClassification.Hook });
    results.sceneTypeSearch = {
      passed: sceneTypeSearch.length >= 1,
      detail: `${sceneTypeSearch.length} result(s) with hook scenes`,
    };

    const status = engine.buildStatusReport();
    results.knowledgeBridge = {
      passed: status.knowledgeBridgeStatus === "connected",
      detail: status.knowledgeBridgeStatus,
    };

    results.memoryBridge = {
      passed: status.memoryBridgeStatus === "connected",
      detail: status.memoryBridgeStatus,
    };

    results.productIntelligenceBridge = {
      passed: status.productIntelligenceBridgeStatus === "connected",
      detail: status.productIntelligenceBridgeStatus,
    };

    results.imageIntelligenceBridge = {
      passed: status.imageIntelligenceBridgeStatus === "connected",
      detail: status.imageIntelligenceBridgeStatus,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(
      storageRoot,
      "logs",
      `scene-detection-intelligence-engine-${logDate}.jsonl`
    );
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.performance = {
      passed: status.performance.averageDetectionMs < 120000,
      detail: `avg detection ${status.performance.averageDetectionMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("scene-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.moduleName}, v${registered?.version}`,
    };

    await core.stop("step-7d-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Scene-Detection-Report.md"),
      buildSceneReport(status, results, storageRoot, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Shot-Detection-Report.md"),
      buildShotReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Transition-Report.md"),
      buildTransitionReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Timeline-Detection-Report.md"),
      buildTimelineReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Scene-Readiness-Report.md"),
      buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-7D-VALIDATION-REPORT.md"),
      buildSceneReport(status, results, storageRoot, allPassed),
      "utf8"
    );

    console.log("Reports written:", projectStateDir);
    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildSceneReport(
  status: SceneDetectionEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# Scene Detection Report — Step 7D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage:** \`${storageRoot}\``,
    `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
    `**Readiness:** ${status.readinessScore}/100`,
    "",
    "## Validation Results",
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(([k, r]) => `| ${k} | ${r.passed ? "✅" : "❌"} | ${r.detail} |`),
    "",
    "## Engine Status",
    "",
    `- Videos processed: ${status.videosProcessed}`,
    `- Total scenes: ${status.totalScenesDetected}`,
    `- Total shots: ${status.totalShotsDetected}`,
    `- Avg scene score: ${status.averageSceneDetectionScore}`,
    `- Avg timeline accuracy: ${status.averageTimelineAccuracyScore}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 7D Scene Detection Intelligence Engine validation complete. Awaiting user approval before Step 7E.",
    "",
  ].join("\n");
}

function buildShotReport(
  commercial: SceneDetectionRecord | undefined,
  social: SceneDetectionRecord | undefined,
  tutorial: SceneDetectionRecord | undefined
): string {
  const rows = [commercial, social, tutorial].filter(Boolean);
  return [
    "# Shot Detection Report — Step 7D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Shots | Shot Score | Camera Changes | Shot Types |",
    "|-------|-------|------------|----------------|------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.shotCount} | ${r!.scores.shotDetectionScore} | ${r!.shots.filter((s) => s.cameraChange).length} | ${[...new Set(r!.shots.map((s) => s.shotType))].join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildTransitionReport(
  commercial: SceneDetectionRecord | undefined,
  social: SceneDetectionRecord | undefined,
  tutorial: SceneDetectionRecord | undefined
): string {
  const rows = [commercial, social, tutorial].filter(Boolean);
  return [
    "# Transition Report — Step 7D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Transitions | Transition Score | Types |",
    "|-------|-------------|------------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.transitionCount} | ${r!.scores.transitionScore} | ${[...new Set(r!.transitions.map((t) => t.type))].join(", ")} |`
    ),
    "",
    "## Commercial Transitions",
    "",
    commercial
      ? commercial.transitions.map((t) => `- ${t.label} (${t.type}, ${t.durationMs}ms)`).join("\n")
      : "N/A",
    "",
  ].join("\n");
}

function buildTimelineReport(
  commercial: SceneDetectionRecord | undefined,
  social: SceneDetectionRecord | undefined,
  tutorial: SceneDetectionRecord | undefined
): string {
  const rows = [commercial, social, tutorial].filter(Boolean);
  return [
    "# Timeline Detection Report — Step 7D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Timeline Length | Scenes | Timeline Accuracy | Timeline Indexes |",
    "|-------|-----------------|--------|-------------------|------------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${(r!.timelineLengthMs / 1000).toFixed(1)}s | ${r!.sceneCount} | ${r!.scores.timelineAccuracyScore} | ${r!.indexes.timelineIndexIds.length} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(
  status: SceneDetectionEngineStatusReport,
  commercial: SceneDetectionRecord | undefined,
  social: SceneDetectionRecord | undefined,
  tutorial: SceneDetectionRecord | undefined,
  allPassed: boolean
): string {
  const rows = [commercial, social, tutorial].filter(Boolean);
  return [
    "# Scene Readiness Report — Step 7D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "## Detection Scores",
    "",
    "| Video | Scene | Shot | Transition | Timeline | Confidence |",
    "|-------|-------|------|------------|----------|------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.scores.sceneDetectionScore} | ${r!.scores.shotDetectionScore} | ${r!.scores.transitionScore} | ${r!.scores.timelineAccuracyScore} | ${r!.scores.aiConfidenceScore} |`
    ),
    "",
    "## Index Summary",
    "",
    ...rows.map(
      (r) =>
        `- **${r!.videoId}:** ${r!.indexes.sceneIndexIds.length} scene, ${r!.indexes.shotIndexIds.length} shot, ${r!.indexes.transitionIndexIds.length} transition indexes`
    ),
    "",
  ].join("\n");
}

void main();
