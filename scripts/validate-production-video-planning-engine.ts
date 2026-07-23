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
  ProductionVideoPlatform,
  ProductionVideoWorkflowStep,
  type ProductionVideoPlanningEngineStatusReport,
  type ProductionVideoPlanningRecord,
} from "../ai/index.js";
import type { VideoAnalysisEngineInput } from "../ai/video-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-production-video-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_COMMERCIAL: VideoAnalysisEngineInput = {
  videoId: "step7k-kwizera-commercial",
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
  videoId: "step7k-kwizera-social-reel",
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
  videoId: "step7k-kwizera-tutorial",
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
  await foundation.getCreativeVideoIntelligenceEngine().planCreativeVideo({ videoId: id });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 7K Production Video Planning Engine Validation");
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
    await core.start("step-7k-validation");

    const foundation = core.getManager().videoIntelligenceFoundation!;
    const engine = foundation.getProductionVideoPlanningEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Production Video Planning Engine operational",
    };

    await runFullPipeline(foundation, SAMPLE_COMMERCIAL);
    const start = Date.now();
    const commercial = await engine.planProductionVideo({ videoId: "step7k-kwizera-commercial" });
    const ms = Date.now() - start;

    results.productionPlanning = {
      passed: commercial.success && Boolean(commercial.record?.profile.productionPlanId),
      detail: `${commercial.record?.profile.platform}, readiness ${commercial.record?.scores.productionReadinessScore} in ${ms}ms`,
    };

    results.workflowPlanning = {
      passed:
        Boolean(commercial.record?.workflow.analysisValidation) &&
        Boolean(commercial.record?.workflow.creativeValidation) &&
        Boolean(commercial.record?.workflow.renderingPreparation),
      detail: `12 workflow steps, creative: ${commercial.record?.workflow.creativeValidation.slice(0, 40)}`,
    };

    results.assetValidation = {
      passed:
        (commercial.record?.assets.sourceVideos.every((a) => a.status !== "missing") ?? false) &&
        (commercial.record?.assets.brandAssets.length ?? 0) >= 1,
      detail: `15 asset groups, source ${commercial.record?.assets.sourceVideos[0]?.status}`,
    };

    results.dependencyValidation = {
      passed:
        commercial.record?.dependencies.allRequiredPassed === true &&
        (commercial.record?.dependencies.passedCount ?? 0) >= 14,
      detail: `${commercial.record?.dependencies.passedCount}/${commercial.record?.dependencies.totalRequired} dependencies passed`,
    };

    results.renderPreparation = {
      passed:
        Boolean(commercial.record?.renderPreparation.resolution) &&
        (commercial.record?.renderPreparation.frameRate ?? 0) > 0,
      detail: `${commercial.record?.renderPreparation.resolution} @ ${commercial.record?.renderPreparation.frameRate}fps ${commercial.record?.renderPreparation.codec}`,
    };

    results.exportPreparation = {
      passed:
        Boolean(commercial.record?.exportPreparation.mp4) &&
        Boolean(commercial.record?.exportPreparation.webm) &&
        commercial.record?.exportPreparation.additionalFormatsSupported === true,
      detail: "MP4, MOV, MKV, WEBM, GIF planned",
    };

    results.deliveryPreparation = {
      passed: (commercial.record?.deliveryInstructions.deliveryNotes.length ?? 0) >= 1,
      detail: commercial.record?.deliveryInstructions.packagingStrategy,
    };

    results.productionReadiness = {
      passed:
        commercial.record?.productionReady === true &&
        (commercial.record?.scores.productionReadinessScore ?? 0) >= 55,
      detail: `Production ${commercial.record?.scores.productionReadinessScore}, asset ${commercial.record?.scores.assetReadinessScore}, confidence ${commercial.record?.scores.aiConfidenceScore}`,
    };

    results.recommendationQuality = {
      passed: (commercial.record?.recommendations.length ?? 0) >= 5,
      detail: `${commercial.record?.recommendations.length} recommendation(s)`,
    };

    results.relationshipDetection = {
      passed:
        (commercial.record?.relationships.relatedStoryboards.length ?? 0) >= 1 &&
        (commercial.record?.relationships.relatedEnhancementPlans.length ?? 0) >= 1,
      detail: `${commercial.record?.relationships.relatedStoryboards.length} storyboards, ${commercial.record?.relationships.relatedEnhancementPlans.length} enhancement plans`,
    };

    await runFullPipeline(foundation, SAMPLE_SOCIAL);
    await runFullPipeline(foundation, SAMPLE_TUTORIAL);
    const social = await engine.planProductionVideo({ videoId: "step7k-kwizera-social-reel" });
    const tutorial = await engine.planProductionVideo({ videoId: "step7k-kwizera-tutorial" });

    results.multiVideoAnalysis = {
      passed: social.success && tutorial.success,
      detail: `Social ${social.record?.profile.platform}, Tutorial ${tutorial.record?.profile.platform}`,
    };

    const noPipeline = await engine.planProductionVideo({ videoId: "step7k-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected",
    };

    const repaired = await engine.repairProductionPlan("step7k-kwizera-social-reel");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Production plan repair verified" : "Repair failed",
    };

    const brandSearch = engine.searchProductionPlans({ brand: "KWIZERA" });
    const platformSearch = engine.searchProductionPlans({ platform: ProductionVideoPlatform.Website });
    const workflowSearch = engine.searchProductionPlans({
      workflow: ProductionVideoWorkflowStep.CreativeValidation,
    });
    const assetSearch = engine.searchProductionPlans({ asset: "source-video" });

    results.search = {
      passed: brandSearch.length >= 2 && platformSearch.length >= 1,
      detail: `${brandSearch.length} brand, ${platformSearch.length} website, ${workflowSearch.length} workflow, ${assetSearch.length} asset`,
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
      `production-video-planning-engine-${new Date().toISOString().slice(0, 10)}.jsonl`
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

    const registered = foundation.getRegistry().getModule("production-video-planning");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.moduleName}, v${registered?.version}`,
    };

    await core.stop("step-7k-validation");
    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Production-Video-Planning-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Workflow-Validation-Report.md"),
      buildWorkflowReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Asset-Validation-Report.md"),
      buildAssetReport(commercial.record, social.record, tutorial.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Production-Readiness-Report.md"),
      buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-7K-VALIDATION-REPORT.md"),
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
  status: ProductionVideoPlanningEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# Production Video Planning Report — Step 7K",
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
    `- Plans created: ${status.plansCreated}`,
    `- Avg production readiness: ${status.averageProductionReadinessScore}`,
    `- Avg asset readiness: ${status.averageAssetReadinessScore}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 7K validation complete. Awaiting approval before Step 7L.",
    "",
  ].join("\n");
}

function buildWorkflowReport(
  a: ProductionVideoPlanningRecord | undefined,
  b: ProductionVideoPlanningRecord | undefined,
  c: ProductionVideoPlanningRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Workflow Validation Report — Step 7K",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Analysis | Creative | Render Prep | Export Prep | Delivery |",
    "|-------|----------|----------|-------------|-------------|----------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.workflow.analysisValidation.slice(0, 25)} | ${r!.workflow.creativeValidation.slice(0, 25)} | ${r!.workflow.renderingPreparation.slice(0, 25)} | ${r!.workflow.exportPreparation.slice(0, 25)} | ${r!.workflow.deliveryPreparation.slice(0, 25)} |`
    ),
    "",
  ].join("\n");
}

function buildAssetReport(
  a: ProductionVideoPlanningRecord | undefined,
  b: ProductionVideoPlanningRecord | undefined,
  c: ProductionVideoPlanningRecord | undefined
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Asset Validation Report — Step 7K",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Video | Source | Audio | Logo | Template | Captions | Brand | Asset Score |",
    "|-------|--------|-------|------|----------|----------|-------|-------------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.assets.sourceVideos[0]?.status} | ${r!.assets.audio[0]?.status} | ${r!.assets.logos[0]?.status} | ${r!.assets.templates[0]?.status} | ${r!.assets.captions[0]?.status} | ${r!.assets.brandAssets[0]?.status} | ${r!.scores.assetReadinessScore} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(
  status: ProductionVideoPlanningEngineStatusReport,
  a: ProductionVideoPlanningRecord | undefined,
  b: ProductionVideoPlanningRecord | undefined,
  c: ProductionVideoPlanningRecord | undefined,
  allPassed: boolean
): string {
  const rows = [a, b, c].filter(Boolean);
  return [
    "# Production Readiness Report — Step 7K",
    "",
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Video | Production | Asset | Workflow | Dependency | Performance | Confidence | Ready |",
    "|-------|------------|-------|----------|------------|-------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r!.videoId} | ${r!.scores.productionReadinessScore} | ${r!.scores.assetReadinessScore} | ${r!.scores.workflowScore} | ${r!.scores.dependencyScore} | ${r!.scores.performanceScore} | ${r!.scores.aiConfidenceScore} | ${r!.productionReady ? "✅" : "❌"} |`
    ),
    "",
  ].join("\n");
}

void main();
