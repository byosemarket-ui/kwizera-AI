import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  QUALITY_PLATFORM_TARGETS,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  QualityIssueSeverity,
  StoryboardGenerationPlatform,
  type VideoQualityValidationEngineStatusReport,
  type QualityValidationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-quality-validation-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step8l-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation",
  features: ["AI video generation"],
  specifications: { license: "pro" },
  materials: ["digital-license"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2B,
  tags: ["software"],
  keywords: ["kwizera"],
};

const SAMPLE_FASHION: ProductAnalysisEngineInput = {
  productId: "step8l-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium urban jacket",
  features: ["water-resistant"],
  specifications: { fabric: "cotton-blend" },
  materials: ["cotton"],
  price: 129.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "fashion" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.D2C,
  tags: ["fashion"],
  keywords: ["jacket"],
};

const SAMPLE_BEAUTY: ProductAnalysisEngineInput = {
  productId: "step8l-glow-serum",
  productName: "Radiance Vitamin C Serum",
  category: ProductAnalysisCategory.Beauty,
  subcategory: "skincare",
  brand: "GlowLab",
  description: "Clinical-grade vitamin C serum",
  features: ["vitamin-c"],
  specifications: { volume: "30ml" },
  materials: ["glass-bottle"],
  price: 45.0,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "beauty" as ProductAnalysisEngineInput["industry"],
  tags: ["beauty"],
  keywords: ["serum"],
};

async function prepareFullPipeline(
  piFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  genFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoGenerationFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective,
  platform: CreativePlatform,
  genPlatform: StoryboardGenerationPlatform
): Promise<string | undefined> {
  await piFoundation.getProductAnalysisEngine().analyzeProduct(sample);
  await piFoundation.getProductUnderstandingEngine().understandProduct({
    productId: sample.productId!,
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: sample.productId! });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: sample.productId!,
    marketingObjective: objective,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: sample.productId!,
    platform,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: sample.productId!,
    includeSocialProof: true,
  });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: sample.productId!,
    platform: genPlatform,
  });
  if (!story.record) return undefined;

  const scenes = await genFoundation.getSceneGenerationEngine().generateScenes({
    storyboardId: story.record.storyboardId,
  });
  if (!scenes.success) return undefined;

  const camera = await genFoundation.getCameraDirectorEngine().planCamera({
    storyboardId: story.record.storyboardId,
  });
  if (!camera.success) return undefined;

  const motion = await genFoundation.getMotionGenerationEngine().generateMotionPlans({
    storyboardId: story.record.storyboardId,
  });
  if (!motion.success) return undefined;

  const animation = await genFoundation.getAnimationGenerationEngine().generateAnimationPlans({
    storyboardId: story.record.storyboardId,
  });
  if (!animation.success) return undefined;

  const vfx = await genFoundation.getVisualEffectsGenerationEngine().generateVisualEffectPlans({
    storyboardId: story.record.storyboardId,
  });
  if (!vfx.success) return undefined;

  const audio = await genFoundation.getAudioSynchronizationEngine().generateAudioSyncPlans({
    storyboardId: story.record.storyboardId,
  });
  if (!audio.success) return undefined;

  const marketing = await genFoundation.getMarketingVideoEngine().generateMarketingVideoPlans({
    storyboardId: story.record.storyboardId,
  });
  if (!marketing.success) return undefined;

  const production = await genFoundation.getVideoProductionEngine().generateProductionPlans({
    storyboardId: story.record.storyboardId,
  });
  if (!production.success) return undefined;

  const rendering = await genFoundation.getRenderingPreparationEngine().prepareRenderPlans({
    storyboardId: story.record.storyboardId,
  });
  if (!rendering.success) return undefined;

  return story.record.storyboardId;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 8L Video Quality Validation Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("Project state:", projectStateDir);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({
      storageRootOverride: storageRoot,
      skipPlanningEngine: true,
      skipWorkflowEngine: true,
      skipTaskManager: true,
    });
    const initStart = Date.now();
    await core.start("step-8l-validation");
    const initMs = Date.now() - initStart;

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const qualityEngine = genFoundation.getVideoQualityValidationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: qualityEngine.isInitialized() && qualityEngine.isStartupComplete(),
      detail: qualityEngine.isStartupComplete()
        ? `Video Quality Validation Engine ready in ${initMs}ms`
        : "Not initialized",
    };

    const registered = genFoundation.getRegistry().getModule("video-quality-validation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    const techStoryboardId = await prepareFullPipeline(
      piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch,
      CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm
    );
    const fashionStoryboardId = await prepareFullPipeline(
      piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion,
      CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels
    );
    const beautyStoryboardId = await prepareFullPipeline(
      piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness,
      CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok
    );

    results.renderUpstream = {
      passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
      detail: "Render plans prepared for quality validation",
    };

    const techValidation = await qualityEngine.validateVideoQuality({ storyboardId: techStoryboardId! });
    const fashionValidation = await qualityEngine.validateVideoQuality({ storyboardId: fashionStoryboardId! });
    const beautyValidation = await qualityEngine.validateVideoQuality({ storyboardId: beautyStoryboardId! });

    results.qualityValidation = {
      passed: techValidation.success && fashionValidation.success && beautyValidation.success,
      detail: `Tech ${techValidation.validations?.length ?? 0}, Fashion ${fashionValidation.validations?.length ?? 0}, Beauty ${beautyValidation.validations?.length ?? 0} validations`,
    };

    const firstRecord = techValidation.validations?.[0];

    results.productionReadiness = {
      passed: firstRecord?.productionReadiness.allInputsReady === true &&
        firstRecord?.productionReadiness.renderPlansReady === true,
      detail: `All inputs ready: ${firstRecord?.productionReadiness.allInputsReady}`,
    };

    results.visualValidation = {
      passed: firstRecord?.videoQuality.allVisualChecksPassed === true &&
        Boolean(firstRecord?.videoQuality.sceneContinuity && firstRecord?.videoQuality.colorConsistency),
      detail: `Visual checks passed: ${firstRecord?.videoQuality.allVisualChecksPassed}`,
    };

    results.audioValidation = {
      passed: firstRecord?.audioQuality.allAudioChecksPassed === true &&
        Boolean(firstRecord?.audioQuality.voiceQuality && firstRecord?.audioQuality.lipSync),
      detail: `Audio checks passed: ${firstRecord?.audioQuality.allAudioChecksPassed}`,
    };

    results.textValidation = {
      passed: firstRecord?.textQuality.allTextChecksPassed === true &&
        Boolean(firstRecord?.textQuality.subtitles && firstRecord?.textQuality.captions),
      detail: `Text checks passed: ${firstRecord?.textQuality.allTextChecksPassed}`,
    };

    results.brandValidation = {
      passed: firstRecord?.brandQuality.allBrandChecksPassed === true &&
        Boolean(firstRecord?.brandQuality.logoUsage && firstRecord?.brandQuality.brandColors),
      detail: `Brand checks passed: ${firstRecord?.brandQuality.allBrandChecksPassed}`,
    };

    results.platformValidation = {
      passed: (firstRecord?.platformValidations.length ?? 0) === QUALITY_PLATFORM_TARGETS.length,
      detail: `${firstRecord?.platformValidations.length}/${QUALITY_PLATFORM_TARGETS.length} platform validations`,
    };

    results.technicalValidation = {
      passed: firstRecord?.technicalQuality.allTechnicalChecksPassed === true &&
        Boolean(firstRecord?.technicalQuality.resolution && firstRecord?.technicalQuality.codec),
      detail: `${firstRecord?.technicalQuality.resolution} @ ${firstRecord?.technicalQuality.frameRate}`,
    };

    results.dependencyValidation = {
      passed: firstRecord?.dependencyValidation.allDependenciesReady === true,
      detail: `Dependencies ready: ${firstRecord?.dependencyValidation.allDependenciesReady}`,
    };

    results.qualityScores = {
      passed:
        (firstRecord?.scores.overallQualityScore ?? 0) >= 55 &&
        (firstRecord?.scores.visualQualityScore ?? 0) >= 50 &&
        (firstRecord?.scores.audioQualityScore ?? 0) >= 50 &&
        (firstRecord?.scores.renderReadinessScore ?? 0) >= 55 &&
        (firstRecord?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Overall ${firstRecord?.scores.overallQualityScore}, render readiness ${firstRecord?.scores.renderReadinessScore}, confidence ${firstRecord?.scores.aiConfidenceScore}`,
    };

    results.issueDetection = {
      passed: (firstRecord?.issues.length ?? 0) >= 0 &&
        !firstRecord?.issues.some((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired),
      detail: `${firstRecord?.issues.length} issues, critical unresolved: ${firstRecord?.issues.filter((i) => i.severity === QualityIssueSeverity.Critical && !i.repaired).length}`,
    };

    results.approvalGate = {
      passed: techValidation.validations?.every((v) => v.approved && v.validated && v.criticalIssuesResolved) ?? false,
      detail: "All validations approved with no unresolved critical issues",
    };

    results.relationships = {
      passed:
        (firstRecord?.relationships.storyboards.length ?? 0) >= 1 &&
        (firstRecord?.relationships.renderPlans.length ?? 0) >= 1 &&
        (firstRecord?.relationships.productionPlans.length ?? 0) >= 1,
      detail: `Render plans ${firstRecord?.relationships.renderPlans.length}, production ${firstRecord?.relationships.productionPlans.length}`,
    };

    results.recommendationQuality = {
      passed: (firstRecord?.recommendations.length ?? 0) >= 2,
      detail: `${firstRecord?.recommendations.length} recommendations`,
    };

    const noUpstream = await qualityEngine.validateVideoQuality({ storyboardId: "step8l-nonexistent" });
    results.incompleteRejection = {
      passed: !noUpstream.success,
      detail: noUpstream.message ?? "Rejected without render plans",
    };

    const repaired = await qualityEngine.repairValidation(techStoryboardId!);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Quality validation repair verified" : "Repair failed",
    };

    const scoreSearch = qualityEngine.searchValidations({ minQualityScore: 55 });
    results.searchByQualityScore = {
      passed: scoreSearch.length >= 1,
      detail: `${scoreSearch.length} result(s) by quality score`,
    };

    const validationSearch = qualityEngine.searchValidations({ validation: "verified" });
    results.searchByValidation = {
      passed: validationSearch.length >= 1,
      detail: `${validationSearch.length} result(s) by validation`,
    };

    const productSearch = qualityEngine.searchValidations({ productId: "step8l-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const keywordSearch = qualityEngine.searchValidations({ keywords: "render" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstRecord!.validationId);
    results.generationAssetRegistration = {
      passed: assetRegistered?.assetType === "export-profile",
      detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
    };

    const status = qualityEngine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageValidationMs < 120000,
      detail: `avg validation ${status.performance.averageValidationMs}ms, repair ${status.performance.averageRepairMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `video-quality-validation-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiIndustry = {
      passed: fashionValidation.success && beautyValidation.success,
      detail: `Fashion ${fashionValidation.validations?.length} validations, Beauty ${beautyValidation.validations?.length} validations`,
    };

    await core.stop("step-8l-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Video-Quality-Validation-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, techValidation.validations, fashionValidation.validations, beautyValidation.validations),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Visual-Validation-Report.md"),
      buildVisualReport(techValidation.validations),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Audio-Validation-Report.md"),
      buildAudioReport(techValidation.validations),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Brand-Validation-Report.md"),
      buildBrandReport(techValidation.validations),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Render-Readiness-Report.md"),
      buildReadinessReport(status, techValidation.validations, fashionValidation.validations, beautyValidation.validations),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-8L-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, techValidation.validations, fashionValidation.validations, beautyValidation.validations),
      "utf8"
    );

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);
    console.log("Reports written:");
    console.log(`  ${path.join(projectStateDir, "AI-Video-Quality-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Visual-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Audio-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Brand-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Render-Readiness-Report.md")}`);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMainReport(
  status: VideoQualityValidationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: QualityValidationRecord[],
  fashion?: QualityValidationRecord[],
  beauty?: QualityValidationRecord[]
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 8 Step 8L Video Quality Validation Report",
    "",
    `**Phase:** 8 — Video Generation Engine`,
    `**Step:** 8L — AI Video Quality Validation Engine`,
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    `**Permanent storage:** \`${DEFAULT_STORAGE_ROOT}\``,
    "",
    "## Engine Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    `| **Validations Generated** | ${status.validationsGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Quality Validations",
    "",
    `- Technology: ${tech?.length ?? 0} validations`,
    `- Fashion: ${fashion?.length ?? 0} validations`,
    `- Beauty: ${beauty?.length ?? 0} validations`,
    "",
  ].join("\n");
}

function buildVisualReport(validations?: QualityValidationRecord[]): string {
  const lines = ["# Visual Validation Report — Step 8L", "", `**Date:** ${new Date().toISOString()}`, ""];
  for (const record of validations ?? []) {
    const v = record.videoQuality;
    lines.push(
      `## ${record.validationId}`,
      "",
      `- Scene continuity: ${v.sceneContinuity}`,
      `- Camera continuity: ${v.cameraContinuity}`,
      `- Visual consistency: ${v.visualConsistency}`,
      `- Color consistency: ${v.colorConsistency}`,
      `- All visual checks passed: ${v.allVisualChecksPassed}`,
      `- Visual score: ${record.scores.visualQualityScore}`,
      ""
    );
  }
  return lines.join("\n");
}

function buildAudioReport(validations?: QualityValidationRecord[]): string {
  const lines = ["# Audio Validation Report — Step 8L", "", `**Date:** ${new Date().toISOString()}`, ""];
  for (const record of validations ?? []) {
    const a = record.audioQuality;
    lines.push(
      `## ${record.validationId}`,
      "",
      `- Voice quality: ${a.voiceQuality}`,
      `- Music quality: ${a.musicQuality}`,
      `- Lip sync: ${a.lipSync}`,
      `- Audio balance: ${a.audioBalance}`,
      `- All audio checks passed: ${a.allAudioChecksPassed}`,
      `- Audio score: ${record.scores.audioQualityScore}`,
      ""
    );
  }
  return lines.join("\n");
}

function buildBrandReport(validations?: QualityValidationRecord[]): string {
  const lines = ["# Brand Validation Report — Step 8L", "", `**Date:** ${new Date().toISOString()}`, ""];
  for (const record of validations ?? []) {
    const b = record.brandQuality;
    lines.push(
      `## ${record.validationId}`,
      "",
      `- Logo usage: ${b.logoUsage}`,
      `- Brand colors: ${b.brandColors}`,
      `- Brand typography: ${b.brandTypography}`,
      `- Marketing consistency: ${b.marketingConsistency}`,
      `- All brand checks passed: ${b.allBrandChecksPassed}`,
      `- Brand score: ${record.scores.brandConsistencyScore}`,
      ""
    );
  }
  return lines.join("\n");
}

function buildReadinessReport(
  status: VideoQualityValidationEngineStatusReport,
  tech?: QualityValidationRecord[],
  fashion?: QualityValidationRecord[],
  beauty?: QualityValidationRecord[]
): string {
  const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
  return [
    "# Render Readiness Report — Step 8L",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    `**Avg Overall Quality:** ${status.averageOverallQualityScore}/100`,
    `**Avg Render Readiness:** ${status.averageRenderReadinessScore}/100`,
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Validations | ${status.validationsGenerated} |`,
    `| Approved | ${all.filter((v) => v.approved).length}/${all.length} |`,
    `| Validated | ${all.filter((v) => v.validated).length}/${all.length} |`,
    `| Critical resolved | ${all.filter((v) => v.criticalIssuesResolved).length}/${all.length} |`,
    "",
    "## Performance",
    "",
    `- Average validation: ${status.performance.averageValidationMs}ms`,
    `- Average repair: ${status.performance.averageRepairMs}ms`,
    "",
  ].join("\n");
}

void main();
