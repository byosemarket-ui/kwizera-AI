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
  CinematicStyleClass,
  StyleTemplatePlatform,
  type VideoStyleEngineStatusReport,
  type VideoStyleIntelligenceRecord,
} from "../ai/index.js";
import type { VideoAnalysisEngineInput } from "../ai/video-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-style-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_COMMERCIAL: VideoAnalysisEngineInput = {
  videoId: "step7h-kwizera-commercial",
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
  visual: { sharpness: 88, visualStability: 85, saturation: 72, contrast: 78, dominantColors: ["#1a1a2e", "#e94560"] },
  frame: { frameConsistencyScore: 92, sceneChangeCandidates: 4, motionDensity: 58, visualComplexity: 55 },
  tags: ["commercial", "validation"],
  keywords: ["commercial", "kwizera"],
  campaign: "pro-launch-2026",
  creativeStyle: "premium modern",
  category: "technology",
};

const SAMPLE_SOCIAL: VideoAnalysisEngineInput = {
  videoId: "step7h-kwizera-social-reel",
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
  visual: { sharpness: 80, visualStability: 78, saturation: 80, contrast: 70 },
  frame: { frameConsistencyScore: 88, sceneChangeCandidates: 3, motionDensity: 72 },
  tags: ["social", "validation"],
  keywords: ["reel", "social"],
};

const SAMPLE_TUTORIAL: VideoAnalysisEngineInput = {
  videoId: "step7h-kwizera-tutorial",
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
  visual: { sharpness: 82, visualStability: 88, saturation: 55, contrast: 65 },
  frame: { frameConsistencyScore: 90, sceneChangeCandidates: 12, motionDensity: 35 },
  tags: ["tutorial", "validation"],
  keywords: ["tutorial", "kwizera"],
  category: "education",
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
  await foundation.getMotionIntelligenceEngine().analyzeMotion({ videoId: id });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 7H Video Style Intelligence Engine Validation");
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
    await core.start("step-7h-validation");

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const engine = foundation.getVideoStyleIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Video Style Intelligence Engine operational",
    };

    await runFullPipeline(foundation, SAMPLE_COMMERCIAL);
    const start = Date.now();
    const commercial = await engine.analyzeStyle({ videoId: "step7h-kwizera-commercial" });
    const ms = Date.now() - start;

    results.styleDetection = {
      passed: commercial.success && Boolean(commercial.record?.profile.styleId),
      detail: `${commercial.record?.profile.styleName} in ${ms}ms, consistency ${commercial.record?.scores.styleConsistencyScore}`,
    };

    results.editingStyle = {
      passed:
        Boolean(commercial.record?.editingStyle.pacing) &&
        Boolean(commercial.record?.editingStyle.transitionStyle),
      detail: `Pacing ${commercial.record?.editingStyle.pacing}, rhythm ${commercial.record?.editingStyle.editingRhythm}`,
    };

    results.cinematicClassification = {
      passed: (commercial.record?.cinematicStyles.length ?? 0) >= 2,
      detail: `Dominant: ${commercial.record?.dominantCinematicStyle}, all: ${commercial.record?.cinematicStyles.join(", ")}`,
    };

    results.brandStyle = {
      passed: (commercial.record?.brandStyle.visualConsistency ?? 0) >= 60,
      detail: `Consistency ${commercial.record?.brandStyle.visualConsistency}, colors ${commercial.record?.brandStyle.brandColors.length}`,
    };

    results.templateLibrary = {
      passed: (commercial.record?.templates.length ?? 0) >= 2,
      detail: `${commercial.record?.templates.length} templates, top: ${commercial.record?.templates[0]?.platform}`,
    };

    results.productionReadiness = {
      passed: (commercial.record?.scores.marketingReadinessScore ?? 0) >= 55,
      detail: `Marketing ${commercial.record?.scores.marketingReadinessScore}, cinematic ${commercial.record?.scores.cinematicScore}`,
    };

    results.recommendationQuality = {
      passed: (commercial.record?.recommendations.length ?? 0) >= 3,
      detail: `${commercial.record?.recommendations.length} recommendation(s)`,
    };

    results.relationshipDetection = {
      passed:
        (commercial.record?.relationships.relatedBrands.length ?? 0) >= 1 &&
        (commercial.record?.relationships.relatedMotionPlans.length ?? 0) >= 1,
      detail: `${commercial.record?.relationships.relatedBrands.length} brands, ${commercial.record?.relationships.relatedCameraPlans.length} camera plans`,
    };

    await runFullPipeline(foundation, SAMPLE_SOCIAL);
    await runFullPipeline(foundation, SAMPLE_TUTORIAL);
    const social = await engine.analyzeStyle({ videoId: "step7h-kwizera-social-reel" });
    const tutorial = await engine.analyzeStyle({ videoId: "step7h-kwizera-tutorial" });

    results.multiVideoAnalysis = {
      passed: social.success && tutorial.success,
      detail: `Social ${social.record?.dominantCinematicStyle}, Tutorial ${tutorial.record?.dominantCinematicStyle}`,
    };

    const noPipeline = await engine.analyzeStyle({ videoId: "step7h-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without prerequisites",
    };

    const repaired = await engine.repairStyleAnalysis("step7h-kwizera-social-reel");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Style analysis repair verified" : "Repair failed",
    };

    const brandSearch = engine.searchStyleAnalysis({ brand: "KWIZERA" });
    const platformSearch = engine.searchStyleAnalysis({ platform: StyleTemplatePlatform.Reels });
    const styleSearch = engine.searchStyleAnalysis({ style: CinematicStyleClass.Commercial });

    results.search = {
      passed: brandSearch.length >= 2 && styleSearch.length >= 1,
      detail: `${brandSearch.length} by brand, ${platformSearch.length} reels, ${styleSearch.length} commercial`,
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
      `video-style-intelligence-engine-${new Date().toISOString().slice(0, 10)}.jsonl`
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

    const registered = foundation.getRegistry().getModule("video-style-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.moduleName}, v${registered?.version}`,
    };

    await core.stop("step-7h-validation");
    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Video-Style-Report.md"),
      buildStyleReport(status, results, storageRoot, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Editing-Style-Report.md"),
      buildEditingReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Brand-Style-Report.md"),
      buildBrandReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Style-Template-Report.md"),
      buildTemplateReport(commercial.record, social.record, tutorial.record, status),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Video-Style-Readiness.md"),
      buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-7H-VALIDATION-REPORT.md"),
      buildStyleReport(status, results, storageRoot, allPassed),
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

function buildStyleReport(
  status: VideoStyleEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# Video Style Report — Step 7H",
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
    `- Templates available: ${status.templatesAvailable}`,
    `- Avg style consistency: ${status.averageStyleConsistencyScore}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 7H validation complete. Awaiting approval before Step 7I.",
    "",
  ].join("\n");
}

function buildEditingReport(
  a: VideoStyleIntelligenceRecord | undefined,
  b: VideoStyleIntelligenceRecord | undefined,
  c: VideoStyleIntelligenceRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Editing Style Report — Step 7H",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Pacing | Rhythm | Transitions | Cuts | Audio Sync |",
    "|-------|--------|--------|-------------|------|------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.editingStyle.pacing} | ${r!.editingStyle.editingRhythm} | ${r!.editingStyle.transitionStyle} | ${r!.editingStyle.cutStyle} | ${r!.editingStyle.audioSyncStyle.slice(0, 30)} |`
    ),
    "",
  ].join("\n");
}

function buildBrandReport(
  a: VideoStyleIntelligenceRecord | undefined,
  b: VideoStyleIntelligenceRecord | undefined,
  c: VideoStyleIntelligenceRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Brand Style Report — Step 7H",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Brand | Consistency | CTA Style | Colors |",
    "|-------|-------|-------------|-----------|--------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.profile.brand} | ${r!.brandStyle.visualConsistency} | ${r!.brandStyle.ctaStyle.slice(0, 35)} | ${r!.brandStyle.brandColors.join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildTemplateReport(
  a: VideoStyleIntelligenceRecord | undefined,
  b: VideoStyleIntelligenceRecord | undefined,
  c: VideoStyleIntelligenceRecord | undefined,
  status: VideoStyleEngineStatusReport
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Style Template Report — Step 7H",
    "",
    `**Library Size:** ${status.templatesAvailable} templates`,
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Top Template | Platform | Match Score | All Matches |",
    "|-------|--------------|----------|-------------|-------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.templates[0]?.name ?? "—"} | ${r!.templates[0]?.platform ?? "—"} | ${r!.templates[0]?.matchScore ?? "—"} | ${r!.templates.map((t) => t.platform).join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(
  status: VideoStyleEngineStatusReport,
  a: VideoStyleIntelligenceRecord | undefined,
  b: VideoStyleIntelligenceRecord | undefined,
  c: VideoStyleIntelligenceRecord | undefined,
  allPassed: boolean
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Video Style Readiness — Step 7H",
    "",
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Video | Consistency | Cinematic | Brand | Editing | Marketing | Confidence |",
    "|-------|-------------|-----------|-------|---------|-----------|------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.scores.styleConsistencyScore} | ${r!.scores.cinematicScore} | ${r!.scores.brandStyleScore} | ${r!.scores.editingQualityScore} | ${r!.scores.marketingReadinessScore} | ${r!.scores.aiConfidenceScore} |`
    ),
    "",
  ].join("\n");
}

void main();
