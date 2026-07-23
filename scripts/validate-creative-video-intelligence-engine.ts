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
  CreativeVideoPlatform,
  CreativeVideoType,
  CreativeVideoTemplateType,
  type CreativeVideoEngineStatusReport,
  type CreativeVideoIntelligenceRecord,
} from "../ai/index.js";
import type { VideoAnalysisEngineInput } from "../ai/video-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-creative-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_COMMERCIAL: VideoAnalysisEngineInput = {
  videoId: "step7j-kwizera-commercial",
  videoName: "KWIZERA Pro Studio Commercial",
  filePath: "uploads/kwizera-pro-commercial.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H264,
  audioCodec: AudioCodec.AAC,
  durationMs: 30_000,
  width: 1920,
  height: 1080,
  fps: 30,
  videoType: VideoAnalysisType.Commercial,
  product: "KWIZERA Pro Studio",
  brand: "KWIZERA",
  sceneCount: 4,
  shotCount: 8,
  visual: { sharpness: 88, visualStability: 85, saturation: 72, contrast: 78, noise: 20 },
  frame: { frameConsistencyScore: 92, motionDensity: 58 },
  campaign: "pro-launch-2026",
  creativeStyle: "premium modern",
  category: "technology",
  keywords: ["commercial"],
};

const SAMPLE_SOCIAL: VideoAnalysisEngineInput = {
  videoId: "step7j-kwizera-social-reel",
  videoName: "KWIZERA Social Reel",
  filePath: "uploads/kwizera-social-reel.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H264,
  audioCodec: AudioCodec.AAC,
  durationMs: 15_000,
  width: 1080,
  height: 1920,
  fps: 30,
  metadata: { platform: "instagram-reels" },
  videoType: VideoAnalysisType.SocialMedia,
  product: "KWIZERA Urban Collection",
  brand: "KWIZERA",
  sceneCount: 3,
  shotCount: 6,
  visual: { sharpness: 80, visualStability: 78 },
  frame: { frameConsistencyScore: 88, motionDensity: 72 },
  keywords: ["reel"],
};

const SAMPLE_TUTORIAL: VideoAnalysisEngineInput = {
  videoId: "step7j-kwizera-tutorial",
  videoName: "KWIZERA Studio Tutorial",
  filePath: "uploads/kwizera-studio-tutorial.mp4",
  fileFormat: VideoFileFormat.MP4,
  container: VideoContainer.MP4,
  videoCodec: VideoCodec.H265,
  audioCodec: AudioCodec.AAC,
  durationMs: 600_000,
  width: 1920,
  height: 1080,
  fps: 24,
  metadata: { instructor: "KWIZERA Academy" },
  videoType: VideoAnalysisType.Tutorial,
  product: "KWIZERA Pro Studio",
  brand: "KWIZERA",
  sceneCount: 12,
  shotCount: 24,
  visual: { sharpness: 82, visualStability: 88 },
  frame: { frameConsistencyScore: 90, motionDensity: 35 },
  category: "education",
  keywords: ["tutorial"],
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
  await foundation.getVideoStyleIntelligenceEngine().analyzeStyle({ videoId: id });
  await foundation.getVideoEnhancementPlanningEngine().planEnhancement({ videoId: id });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 7J Creative Video Intelligence Engine Validation");
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
    await core.start("step-7j-validation");

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const engine = foundation.getCreativeVideoIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Creative Video Intelligence Engine operational",
    };

    await runFullPipeline(foundation, SAMPLE_COMMERCIAL);
    const start = Date.now();
    const commercial = await engine.planCreativeVideo({ videoId: "step7j-kwizera-commercial" });
    const ms = Date.now() - start;

    results.storyboardCreation = {
      passed:
        commercial.success &&
        (commercial.record?.storyboard.sceneOrder.length ?? 0) >= 2 &&
        Boolean(commercial.record?.storyboard.openingHook),
      detail: `${commercial.record?.storyboard.sceneOrder.length} scenes, hook in ${ms}ms`,
    };

    results.creativePlanning = {
      passed: commercial.success && Boolean(commercial.record?.profile.creativeVideoId),
      detail: `${commercial.record?.creativeType}, creative score ${commercial.record?.scores.creativeScore}`,
    };

    results.marketingPlanning = {
      passed: Boolean(commercial.record?.marketingPlan.ctaStrategy),
      detail: commercial.record?.marketingPlan.productShowcase.slice(0, 50),
    };

    results.visualAudioPlanning = {
      passed:
        Boolean(commercial.record?.visualPlan.cameraStyle) &&
        Boolean(commercial.record?.audioPlan.voiceStyle),
      detail: `${commercial.record?.visualPlan.colorStyle.slice(0, 30)} / ${commercial.record?.audioPlan.musicStyle.slice(0, 25)}`,
    };

    results.platformPlanning = {
      passed: (commercial.record?.platformPlans.length ?? 0) >= 7,
      detail: `${commercial.record?.platformPlans.length} platforms, primary ${commercial.record?.profile.platform}`,
    };

    results.templateLibrary = {
      passed: (commercial.record?.templates.length ?? 0) >= 1,
      detail: `Top: ${commercial.record?.templates[0]?.name} (${commercial.record?.templates[0]?.matchScore})`,
    };

    results.productionReadiness = {
      passed: (commercial.record?.scores.productionReadinessScore ?? 0) >= 55,
      detail: `Production ${commercial.record?.scores.productionReadinessScore}, confidence ${commercial.record?.scores.aiConfidenceScore}`,
    };

    results.recommendationQuality = {
      passed: (commercial.record?.recommendations.length ?? 0) >= 4,
      detail: `${commercial.record?.recommendations.length} recommendation(s)`,
    };

    results.relationshipDetection = {
      passed:
        (commercial.record?.relationships.relatedEnhancementPlans.length ?? 0) >= 1 &&
        (commercial.record?.relationships.relatedStoryboards.length ?? 0) >= 2,
      detail: `${commercial.record?.relationships.relatedEnhancementPlans.length} enhancement, ${commercial.record?.relationships.relatedMotionPlans.length} motion`,
    };

    await runFullPipeline(foundation, SAMPLE_SOCIAL);
    await runFullPipeline(foundation, SAMPLE_TUTORIAL);
    const social = await engine.planCreativeVideo({ videoId: "step7j-kwizera-social-reel" });
    const tutorial = await engine.planCreativeVideo({ videoId: "step7j-kwizera-tutorial" });

    results.multiVideoAnalysis = {
      passed: social.success && tutorial.success,
      detail: `Social ${social.record?.creativeType}, Tutorial ${tutorial.record?.creativeType}`,
    };

    const noPipeline = await engine.planCreativeVideo({ videoId: "step7j-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected",
    };

    const repaired = await engine.repairCreativePlan("step7j-kwizera-social-reel");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Creative plan repair verified" : "Repair failed",
    };

    const brandSearch = engine.searchCreativePlans({ brand: "KWIZERA" });
    const typeSearch = engine.searchCreativePlans({ creativeType: CreativeVideoType.Commercial });
    const templateSearch = engine.searchCreativePlans({
      templateType: CreativeVideoTemplateType.ProductAdvertisement,
    });

    results.search = {
      passed: brandSearch.length >= 2 && typeSearch.length >= 1,
      detail: `${brandSearch.length} brand, ${typeSearch.length} commercial, ${templateSearch.length} product-ad template`,
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
      `creative-video-intelligence-engine-${new Date().toISOString().slice(0, 10)}.jsonl`
    );
    results.logging = { passed: fs.existsSync(logFile), detail: logFile };
    results.performance = {
      passed: status.performance.averagePlanningMs < 120000,
      detail: `avg ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
    };
    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("creative-video-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.moduleName}, v${registered?.version}`,
    };

    await core.stop("step-7j-validation");
    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Creative-Video-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Storyboard-Planning-Report.md"),
      buildStoryboardReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Marketing-Planning-Report.md"),
      buildMarketingReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Creative-Readiness-Report.md"),
      buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-7J-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed),
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

function buildMainReport(
  status: CreativeVideoEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# Creative Video Report — Step 7J",
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
    `- Avg creative score: ${status.averageCreativeScore}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 7J validation complete. Awaiting approval before Step 7K.",
    "",
  ].join("\n");
}

function buildStoryboardReport(
  a: CreativeVideoIntelligenceRecord | undefined,
  b: CreativeVideoIntelligenceRecord | undefined,
  c: CreativeVideoIntelligenceRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Storyboard Planning Report — Step 7J",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Structure | Hook | Scenes | Product Reveal | CTA | Ending |",
    "|-------|-----------|------|--------|----------------|-----|--------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.storyboard.storyStructure.slice(0, 30)} | ${r!.storyboard.openingHook.slice(0, 25)} | ${r!.storyboard.sceneOrder.length} | ${r!.storyboard.productReveal.timingMs}ms | ${r!.storyboard.ctaPlacement.timingMs}ms | ${r!.storyboard.endingStrategy.slice(0, 25)} |`
    ),
    "",
  ].join("\n");
}

function buildMarketingReport(
  a: CreativeVideoIntelligenceRecord | undefined,
  b: CreativeVideoIntelligenceRecord | undefined,
  c: CreativeVideoIntelligenceRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Marketing Planning Report — Step 7J",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Product Showcase | Brand Awareness | CTA Strategy | Social Engagement |",
    "|-------|------------------|-----------------|--------------|-------------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.marketingPlan.productShowcase.slice(0, 35)} | ${r!.marketingPlan.brandAwareness.slice(0, 30)} | ${r!.marketingPlan.ctaStrategy.slice(0, 30)} | ${r!.marketingPlan.socialEngagement.slice(0, 25)} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(
  status: CreativeVideoEngineStatusReport,
  a: CreativeVideoIntelligenceRecord | undefined,
  b: CreativeVideoIntelligenceRecord | undefined,
  c: CreativeVideoIntelligenceRecord | undefined,
  allPassed: boolean
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Creative Readiness Report — Step 7J",
    "",
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Video | Creative | Storytelling | Marketing | Visual Impact | Brand | Production | Confidence |",
    "|-------|----------|--------------|-----------|---------------|-------|------------|------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.scores.creativeScore} | ${r!.scores.storytellingScore} | ${r!.scores.marketingScore} | ${r!.scores.visualImpactScore} | ${r!.scores.brandConsistencyScore} | ${r!.scores.productionReadinessScore} | ${r!.scores.aiConfidenceScore} |`
    ),
    "",
  ].join("\n");
}

void main();
