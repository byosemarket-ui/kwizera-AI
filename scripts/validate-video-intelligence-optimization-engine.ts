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

  VideoQualityPredictionPlatform,

  type VideoIntelligenceOptimizationEngineStatusReport,

  type VideoIntelligenceOptimizationRecord,

} from "../ai/index.js";

import type { VideoAnalysisEngineInput } from "../ai/video-analysis-engine/types.js";

import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";



function createTempStorageRoot(): string {

  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-vi-optimization-"));

}



function ensureProjectStateDir(): string {

  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");

  fs.mkdirSync(dir, { recursive: true });

  return dir;

}



const SAMPLE_COMMERCIAL: VideoAnalysisEngineInput = {

  videoId: "step7m-kwizera-commercial",

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

  videoId: "step7m-kwizera-social-reel",

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

  videoId: "step7m-kwizera-tutorial",

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

  await foundation.getProductionVideoPlanningEngine().planProductionVideo({ videoId: id });

  await foundation.getVideoQualityPredictionEngine().predictVideoQuality({

    videoId: id,

    projectId: "step7m-validation",

    platform: VideoQualityPredictionPlatform.Website,

    campaign: input.campaign ?? "validation",

  });

}



async function main(): Promise<void> {

  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();

  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  const projectStateDir = ensureProjectStateDir();



  console.log("KWIZERA AI STUDIO — Step 7M Video Intelligence Optimization Engine Validation");

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

    await core.start("step-7m-validation");



    const foundation = core.getManager().videoIntelligenceFoundation!;

    const engine = foundation.getVideoIntelligenceOptimizationEngine();



    results.initialization = {

      passed: engine.isInitialized() && engine.isStartupComplete(),

      detail: "Video Intelligence Optimization Engine operational",

    };



    await runFullPipeline(foundation, SAMPLE_COMMERCIAL);

    const optStart = Date.now();

    const commercial = await engine.runOptimization({

      videoId: "step7m-kwizera-commercial",

      projectId: "step7m-validation",

    });

    const optMs = Date.now() - optStart;



    results.optimizationRun = {

      passed: commercial.success && Boolean(commercial.record),

      detail: `Commercial optimization in ${optMs}ms, improvement ${commercial.record?.scores.overallImprovementScore}`,

    };



    results.optimizationProfile = {

      passed:

        Boolean(commercial.record?.profile.optimizationId) &&

        Boolean(commercial.record?.profile.videoId) &&

        Boolean(commercial.record?.recoveryPointId),

      detail: `Optimization ${commercial.record?.profile.optimizationId}, v${commercial.record?.profile.optimizationVersion}`,

    };



    results.moduleOptimization = {

      passed:

        (commercial.record?.moduleResults.length ?? 0) === 11 &&

        commercial.record?.moduleResults.every((m) => m.qualityScoreAfter >= m.qualityScoreBefore) === true,

      detail: `${commercial.record?.moduleResults.length} modules optimized without quality reduction`,

    };



    results.optimizationStrategies = {

      passed:

        Boolean(commercial.record?.strategies.cacheOptimization) &&

        Boolean(commercial.record?.strategies.searchOptimization) &&

        Boolean(commercial.record?.strategies.timelineOptimization),

      detail: "All optimization strategy categories applied",

    };



    results.cacheOptimization = {

      passed:

        (commercial.record?.cache.videos.length ?? 0) >= 1 &&

        (commercial.record?.cache.brands.length ?? 0) >= 1 &&

        (commercial.record?.cache.productionPlans.length ?? 0) >= 1 &&

        (commercial.record?.cache.hitRate ?? 0) > 0,

      detail: `Cache hit rate ${commercial.record?.cache.hitRate}%, ${commercial.record?.cache.scenes.length} scenes cached`,

    };



    results.performanceImprovement = {

      passed:

        (commercial.record?.performance.planningSpeedMs ?? 999) <=

          (commercial.record?.performance.planningSpeedBeforeMs ?? 0) &&

        (commercial.record?.scores.planningImprovementScore ?? 0) >= 0,

      detail: `Planning ${commercial.record?.performance.planningSpeedBeforeMs}ms → ${commercial.record?.performance.planningSpeedMs}ms, analysis ${commercial.record?.performance.analysisSpeedBeforeMs}ms → ${commercial.record?.performance.analysisSpeedMs}ms`,

    };



    results.videoQualityImprovement = {

      passed: (commercial.record?.scores.videoQualityImprovementScore ?? 0) >= 5,

      detail: `Video quality improvement ${commercial.record?.scores.videoQualityImprovementScore}/100`,

    };



    results.storytellingImprovement = {

      passed: (commercial.record?.scores.storytellingImprovementScore ?? 0) >= 5,

      detail: `Storytelling improvement ${commercial.record?.scores.storytellingImprovementScore}/100`,

    };



    results.recommendationImprovement = {

      passed: (commercial.record?.scores.recommendationImprovementScore ?? 0) >= 5,

      detail: `Recommendation improvement ${commercial.record?.scores.recommendationImprovementScore}/100`,

    };



    results.workflowOptimization = {

      passed:

        Boolean(commercial.record?.strategies.workflowOptimization) &&

        (commercial.record?.scores.workflowEfficiencyScore ?? 0) >= 10,

      detail: `Workflow efficiency ${commercial.record?.scores.workflowEfficiencyScore}/100`,

    };



    results.recoveryPoint = {

      passed: Boolean(commercial.record?.recoveryPointId) && commercial.recovered !== true,

      detail: `Recovery point ${commercial.record?.recoveryPointId} created before optimization`,

    };



    results.optimizationScores = {

      passed:

        (commercial.record?.scores.overallImprovementScore ?? 0) >= 5 &&

        (commercial.record?.scores.aiConfidenceScore ?? 0) >= 55,

      detail: `Overall ${commercial.record?.scores.overallImprovementScore}, confidence ${commercial.record?.scores.aiConfidenceScore}`,

    };



    await runFullPipeline(foundation, SAMPLE_SOCIAL);

    await runFullPipeline(foundation, SAMPLE_TUTORIAL);

    const social = await engine.runOptimization({ videoId: "step7m-kwizera-social-reel" });

    const tutorial = await engine.runOptimization({ videoId: "step7m-kwizera-tutorial" });



    results.multiProjectOptimization = {

      passed: social.success && tutorial.success,

      detail: `Social improvement ${social.record?.scores.overallImprovementScore}, Tutorial ${tutorial.record?.scores.overallImprovementScore}`,

    };



    results.relationshipDetection = {

      passed:

        (commercial.record?.relationships.qualityPredictions.length ?? 0) >= 1 &&

        (commercial.record?.relationships.relatedProductionPlans.length ?? 0) >= 1,

      detail: `Quality predictions ${commercial.record?.relationships.qualityPredictions.length}, knowledge ${commercial.record?.relationships.knowledgeRecords.length}`,

    };



    const noPipeline = await engine.runOptimization({ videoId: "step7m-nonexistent" });

    results.incompleteRejection = {

      passed: !noPipeline.success,

      detail: noPipeline.message ?? "Rejected without upstream intelligence",

    };



    const repaired = await engine.repairOptimization("step7m-kwizera-social-reel");

    results.automaticRepair = {

      passed: Boolean(repaired?.success),

      detail: repaired?.success ? "Optimization repair pipeline verified" : "Repair failed",

    };



    const recoveryId = commercial.record?.recoveryPointId;

    const restoreTest = recoveryId ? engine.restoreRecoveryPoint(recoveryId) : false;

    results.recoveryValidation = {

      passed: restoreTest === true,

      detail: restoreTest ? "Recovery point restore verified" : "Recovery restore failed",

    };



    const optSearch = engine.searchOptimizations({ optimizationId: commercial.record?.optimizationId });

    results.searchByOptimization = {

      passed: optSearch.length >= 1,

      detail: `${optSearch.length} result(s) by optimization`,

    };



    const brandSearch = engine.searchOptimizations({ brand: "KWIZERA" });

    results.searchByBrand = {

      passed: brandSearch.length >= 1,

      detail: `${brandSearch.length} result(s) by brand`,

    };



    const scoreSearch = engine.searchOptimizations({ minImprovementScore: 5 });

    results.searchByImprovementScore = {

      passed: scoreSearch.length >= 1,

      detail: `${scoreSearch.length} result(s) above improvement threshold`,

    };



    const status = engine.buildStatusReport();

    results.performance = {

      passed: status.performance.averageOptimizationMs < 120000,

      detail: `avg optimization ${status.performance.averageOptimizationMs}ms, search ${status.performance.averageSearchMs}ms`,

    };



    const logFile = path.join(

      storageRoot,

      "logs",

      `video-intelligence-optimization-engine-${new Date().toISOString().slice(0, 10)}.jsonl`

    );

    results.logging = { passed: fs.existsSync(logFile), detail: logFile };



    results.readiness = {

      passed: status.readinessScore >= 85,

      detail: `Readiness ${status.readinessScore}/100`,

    };



    const registered = foundation.getRegistry().getModule("video-intelligence-optimization");

    results.moduleRegistration = {

      passed: registered?.implemented === true && registered.status === "active",

      detail: `Module ${registered?.moduleName}, v${registered?.version}`,

    };



    results.optimizationReadiness = {

      passed: commercial.record?.productionReady === true && commercial.record?.validated === true,

      detail: "Optimized Video Intelligence system ready for continued operation",

    };



    await core.stop("step-7m-validation");

    const allPassed = Object.values(results).every((r) => r.passed);



    fs.writeFileSync(

      path.join(projectStateDir, "Video-Optimization-Report.md"),

      buildOptimizationReport(status, results, storageRoot, allPassed, commercial.record, social.record, tutorial.record),

      "utf8"

    );

    fs.writeFileSync(

      path.join(projectStateDir, "Video-Performance-Optimization-Report.md"),

      buildPerformanceReport(commercial.record, social.record, tutorial.record),

      "utf8"

    );

    fs.writeFileSync(

      path.join(projectStateDir, "Video-Recommendation-Optimization-Report.md"),

      buildRecommendationReport(commercial.record, social.record, tutorial.record),

      "utf8"

    );

    fs.writeFileSync(

      path.join(projectStateDir, "Video-Workflow-Optimization-Report.md"),

      buildWorkflowReport(commercial.record, social.record, tutorial.record),

      "utf8"

    );

    fs.writeFileSync(

      path.join(process.cwd(), "STEP-7M-VALIDATION-REPORT.md"),

      buildOptimizationReport(status, results, storageRoot, allPassed, commercial.record, social.record, tutorial.record),

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



function buildOptimizationReport(

  status: VideoIntelligenceOptimizationEngineStatusReport,

  results: Record<string, { passed: boolean; detail: string }>,

  storageRoot: string,

  allPassed: boolean,

  commercial?: VideoIntelligenceOptimizationRecord,

  social?: VideoIntelligenceOptimizationRecord,

  tutorial?: VideoIntelligenceOptimizationRecord

): string {

  return [

    "# Video Optimization Report — Step 7M",

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

    `- Commercial: ${commercial?.moduleResults.length ?? 0} modules, improvement ${commercial?.scores.overallImprovementScore ?? 0}/100`,

    `- Social: improvement ${social?.scores.overallImprovementScore ?? 0}/100`,

    `- Tutorial: improvement ${tutorial?.scores.overallImprovementScore ?? 0}/100`,

    "",

    `Total optimizations: ${status.optimizationsCompleted}`,

    "",

    "---",

    "",

    "**KWIZERA AI** — Step 7M validation complete. Awaiting approval before Step 7N.",

    "",

  ].join("\n");

}



function buildPerformanceReport(

  commercial?: VideoIntelligenceOptimizationRecord,

  social?: VideoIntelligenceOptimizationRecord,

  tutorial?: VideoIntelligenceOptimizationRecord

): string {

  const rows = [commercial, social, tutorial].filter(Boolean) as VideoIntelligenceOptimizationRecord[];

  return [

    "# Video Performance Optimization Report — Step 7M",

    "",

    `**Date:** ${new Date().toISOString()}`,

    "",

    "| Video | Analysis Before | Analysis After | Planning Before | Planning After | Search Before | Search After | Timeline |",

    "|-------|-----------------|----------------|-----------------|----------------|---------------|--------------|----------|",

    ...rows.map(

      (r) =>

        `| ${r.videoId} | ${r.performance.analysisSpeedBeforeMs}ms | ${r.performance.analysisSpeedMs}ms | ${r.performance.planningSpeedBeforeMs}ms | ${r.performance.planningSpeedMs}ms | ${r.performance.searchSpeedBeforeMs}ms | ${r.performance.searchSpeedMs}ms | ${r.performance.timelineProcessingMs}ms |`

    ),

    "",

    "## Resource Estimates",

    "",

    ...rows.map(

      (r) => `- **${r.videoId}:** ~${r.performance.memoryEstimateMb}MB memory, ~${r.performance.diskUsageEstimateKb}KB disk`

    ),

    "",

  ].join("\n");

}



function buildRecommendationReport(

  commercial?: VideoIntelligenceOptimizationRecord,

  social?: VideoIntelligenceOptimizationRecord,

  tutorial?: VideoIntelligenceOptimizationRecord

): string {

  const rows = [commercial, social, tutorial].filter(Boolean) as VideoIntelligenceOptimizationRecord[];

  const lines = [

    "# Video Recommendation Optimization Report — Step 7M",

    "",

    `**Date:** ${new Date().toISOString()}`,

    "",

  ];



  for (const record of rows) {

    lines.push(

      `## ${record.videoId}`,

      "",

      `- **Recommendation Improvement:** ${record.scores.recommendationImprovementScore}/100`,

      `- **Confidence Improvement:** ${record.scores.confidenceImprovementScore}/100`,

      "",

      "### Strategies",

      `- ${record.strategies.recommendationOptimization}`,

      "",

      "### Module Improvements",

      "| Module | Before | After | Strategies |",

      "|--------|--------|-------|------------|"

    );

    for (const mod of record.moduleResults.filter((m) => m.strategiesApplied.includes("recommendation"))) {

      lines.push(`| ${mod.moduleName} | ${mod.qualityScoreBefore} | ${mod.qualityScoreAfter} | ${mod.strategiesApplied.join(", ")} |`);

    }

    lines.push("");

  }



  return lines.join("\n");

}



function buildWorkflowReport(

  commercial?: VideoIntelligenceOptimizationRecord,

  social?: VideoIntelligenceOptimizationRecord,

  tutorial?: VideoIntelligenceOptimizationRecord

): string {

  const rows = [commercial, social, tutorial].filter(Boolean) as VideoIntelligenceOptimizationRecord[];

  return [

    "# Video Workflow Optimization Report — Step 7M",

    "",

    `**Date:** ${new Date().toISOString()}`,

    "",

    "| Video | Workflow Efficiency | Planning Δ | Rendering Readiness | Recovery Point |",

    "|-------|---------------------|------------|---------------------|----------------|",

    ...rows.map(

      (r) =>

        `| ${r.videoId} | ${r.scores.workflowEfficiencyScore}/100 | ${r.scores.planningImprovementScore}% | ${r.scores.renderingReadinessScore}/100 | ${r.recoveryPointId} |`

    ),

    "",

    "## Workflow Strategies",

    "",

    ...rows.map((r) => `- **${r.videoId}:** ${r.strategies.workflowOptimization}`),

    "",

  ].join("\n");

}



void main();


