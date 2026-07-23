import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  SfxPlatform,
  SfxSyncTarget,
  SoundCategory,
  SUPPORTED_SOUND_CATEGORIES,
  FOLEY_TYPES,
  ENVIRONMENTAL_TYPES,
  type SoundEffectsGenerationEngineStatusReport,
  type SoundEffectsGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-sfx-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step10f-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation for marketing teams",
  features: ["AI audio generation", "sound effects", "SFX planning"],
  specifications: { license: "pro" },
  materials: ["digital-license"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2B,
  tags: ["software", "validation"],
  keywords: ["AI studio", "kwizera"],
};

const SAMPLE_HEALTH: ProductAnalysisEngineInput = {
  productId: "step10f-health-app",
  productName: "VitalCare Health App",
  category: ProductAnalysisCategory.Health,
  subcategory: "wellness",
  brand: "VitalCare",
  description: "Application de santé pour le suivi du bien-être quotidien",
  features: ["suivi", "rappels", "conseils"],
  price: 9.99,
  currency: "EUR",
  availability: ProductAvailabilityStatus.InStock,
  industry: "health" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["health", "validation"],
  keywords: ["santé", "vitalcare"],
};

const SAMPLE_FINANCE: ProductAnalysisEngineInput = {
  productId: "step10f-finance-app",
  productName: "PesaSmart Mobile Banking",
  category: ProductAnalysisCategory.Services,
  subcategory: "mobile-banking",
  brand: "PesaSmart",
  description: "Huduma ya benki ya simu kwa wateja wa Afrika Mashariki",
  features: ["malipo", "akiba", "mikopo"],
  price: 0,
  currency: "KES",
  availability: ProductAvailabilityStatus.InStock,
  industry: "general" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["finance", "validation"],
  keywords: ["benki", "pesasmart"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective,
  platform: CreativePlatform
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(sample);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: sample.productId!,
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: sample.productId!,
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: sample.productId!,
    marketingObjective: objective,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: sample.productId!,
    platform,
  });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 10F Sound Effects Generation Engine Validation");
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
    await core.start("step-10f-validation");
    const initMs = Date.now() - initStart;

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const engine = audioFoundation.getSoundEffectsGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `SFX Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = audioFoundation.getRegistry().getModule("sound-effects-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
    await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);

    const tech = await engine.generateSoundEffectPlan({
      productId: "step10f-kwizera-pro",
      soundPrompt: "Cinematic product launch impact whoosh and UI click sounds",
      platform: SfxPlatform.YouTube,
      soundCategory: SoundCategory.Cinematic,
      syncTarget: SfxSyncTarget.Video,
      videoId: "step10f-tech-launch-video",
      durationSec: 45,
      sceneHint: "Product reveal cinematic sequence",
    });

    const health = await engine.generateSoundEffectPlan({
      productId: "step10f-health-app",
      soundPrompt: "Calm ambient office and gentle notification sounds for wellness app",
      platform: SfxPlatform.Website,
      soundCategory: SoundCategory.Environmental,
      syncTarget: SfxSyncTarget.Presentation,
      durationSec: 60,
      sceneHint: "Wellness app onboarding scene",
    });

    const finance = await engine.generateSoundEffectPlan({
      productId: "step10f-finance-app",
      soundPrompt: "Mobile banking UI clicks and transaction confirmation sounds",
      platform: SfxPlatform.TikTok,
      soundCategory: SoundCategory.Interface,
      syncTarget: SfxSyncTarget.Advertisement,
      durationSec: 15,
      sceneHint: "Mobile banking advertisement",
    });

    const foley = await engine.generateSoundEffectPlan({
      soundPrompt: "Foley footsteps and door sounds for KWIZERA brand film",
      brandName: "KWIZERA",
      platform: SfxPlatform.Television,
      soundCategory: SoundCategory.Foley,
      syncTarget: SfxSyncTarget.Film,
      durationSec: 30,
      sceneHint: "Office walkthrough scene",
    });

    results.soundPlanGeneration = {
      passed: tech.success && health.success && finance.success && foley.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Foley ${foley.success ? "✓" : "✗"}`,
    };

    results.soundAnalysis = {
      passed: Boolean(
        tech.record?.soundAnalysis.scene &&
          tech.record?.soundAnalysis.action &&
          tech.record?.soundAnalysis.objects.length >= 1
      ),
      detail: `Scene: ${tech.record?.soundAnalysis.scene.slice(0, 40)}..., objects ${tech.record?.soundAnalysis.objects.length}`,
    };

    results.foleyPlanning = {
      passed: Boolean(
        tech.record?.foleyPlan.foleyTypes.length >= 1 &&
          tech.record?.foleyPlan.footsteps.length >= 5
      ),
      detail: `${tech.record?.foleyPlan.foleyTypes.length} foley types, ${FOLEY_TYPES.length} supported`,
    };

    results.environmentalPlanning = {
      passed: Boolean(
        health.record?.environmentalPlan.ambientLayers.length >= 1 &&
          health.record?.environmentalPlan.environmentalTypes.length >= 1
      ),
      detail: `${health.record?.environmentalPlan.environmentalTypes.length} env types, ${ENVIRONMENTAL_TYPES.length} supported`,
    };

    results.timelinePlanning = {
      passed: Boolean(
        tech.record?.timelinePlan.cuePoints.length >= 3 &&
          tech.record?.timelinePlan.layerPositions.length >= 2 &&
          tech.record?.timelinePlan.fadeIn &&
          tech.record?.timelinePlan.crossfade
      ),
      detail: `${tech.record?.timelinePlan.cuePoints.length} cue points, ${tech.record?.timelinePlan.layerPositions.length} layers`,
    };

    results.synchronization = {
      passed: Boolean(
        tech.record?.syncPreparation.hitPoints.length >= 1 &&
          tech.record?.syncPreparation.syncTarget &&
          (tech.record?.scores.synchronizationScore ?? 0) >= 55
      ),
      detail: `Sync ${tech.record?.syncPreparation.syncTarget}, score ${tech.record?.scores.synchronizationScore}`,
    };

    results.soundScores = {
      passed:
        (tech.record?.scores.realismScore ?? 0) >= 55 &&
        (tech.record?.scores.synchronizationScore ?? 0) >= 55 &&
        (tech.record?.scores.layerQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Realism ${tech.record?.scores.realismScore}, production ${tech.record?.scores.productionReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.categorySupport = {
      passed: SUPPORTED_SOUND_CATEGORIES.length >= 10,
      detail: `${SUPPORTED_SOUND_CATEGORIES.length} sound categories supported`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.soundPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.videos.length ?? 0) >= 1,
      detail: `Plans ${tech.record?.relationships.soundPlans.length}, products ${tech.record?.relationships.products.length}, videos ${tech.record?.relationships.videos.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noContext = await engine.generateSoundEffectPlan({ productId: "step10f-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected without context",
    };

    const promptOnly = await engine.generateSoundEffectPlan({
      soundPrompt: "Standalone transition whoosh for KWIZERA brand announcement",
      brandName: "KWIZERA",
      platform: SfxPlatform.Website,
      soundCategory: SoundCategory.Transition,
    });
    results.promptOnlyGeneration = {
      passed: promptOnly.success,
      detail: promptOnly.success ? "Prompt-only SFX plan generated" : promptOnly.message ?? "Failed",
    };

    const repaired = await engine.repairSoundEffectPlan("step10f-health-app", SfxPlatform.Facebook);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "SFX plan repair pipeline verified" : "Repair failed",
    };

    const productSearch = engine.searchSoundEffectPlans({ productId: "step10f-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const categorySearch = engine.searchSoundEffectPlans({ soundCategory: SoundCategory.Interface });
    results.searchByCategory = {
      passed: categorySearch.length >= 1,
      detail: `${categorySearch.length} result(s) by category`,
    };

    const sceneSearch = engine.searchSoundEffectPlans({ scene: "cinematic" });
    results.searchByScene = {
      passed: sceneSearch.length >= 1,
      detail: `${sceneSearch.length} result(s) by scene`,
    };

    const keywordSearch = engine.searchSoundEffectPlans({ keywords: "kwizera" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const sfxAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.soundPlanId);
    const foleyAsset = audioFoundation.getAssetRegistry().getAsset(`foley-${tech.record!.soundPlanId}`);
    results.generationAssetRegistration = {
      passed: sfxAsset?.assetType === "sound-effect" && foleyAsset?.assetType === "template",
      detail: `SFX ${sfxAsset?.assetId}, Foley ${foleyAsset?.assetId}`,
    };

    const blueprint = audioFoundation.getBlueprintManager().getBlueprint(tech.record!.blueprintId!);
    results.blueprintLink = {
      passed: Boolean(blueprint?.blueprintId),
      detail: blueprint ? `Blueprint ${blueprint.blueprintId} linked` : "Blueprint not found",
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageGenerationMs < 120000,
      detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `sound-effects-generation-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiIndustry = {
      passed: health.success && finance.success,
      detail: `Healthcare ${health.record?.profile.soundCategory}, Finance ${finance.record?.profile.soundCategory}`,
    };

    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-10f-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Sound-Effects-Generation-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, foley.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Foley-Planning-Report.md"),
      buildFoleyReport(tech.record, health.record, finance.record, foley.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Environmental-Sound-Report.md"),
      buildEnvironmentalReport(tech.record, health.record, finance.record, foley.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Timeline-Planning-Report.md"),
      buildTimelineReport(tech.record, health.record, finance.record, foley.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Sound-Effects-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, health.record, finance.record, foley.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-10F-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, foley.record),
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
    console.log(`  ${path.join(projectStateDir, "AI-Sound-Effects-Generation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Foley-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Environmental-Sound-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Timeline-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Sound-Effects-Readiness-Report.md")}`);

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
  status: SoundEffectsGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: SoundEffectsGenerationRecord,
  health?: SoundEffectsGenerationRecord,
  finance?: SoundEffectsGenerationRecord,
  foley?: SoundEffectsGenerationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 10 Step 10F Sound Effects Generation Report",
    "",
    `**Phase:** 10 — Audio Generation Engine`,
    `**Step:** 10F — AI Sound Effects Generation Engine`,
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
    `| **Sound Plans Generated** | ${status.soundPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Sound Effect Plans",
    "",
    `- Technology (Cinematic): ${tech?.profile.platform ?? "n/a"} (${tech?.scores.realismScore ?? 0}/100)`,
    `- Healthcare (Environmental): ${health?.profile.soundCategory ?? "n/a"} (${health?.scores.layerQualityScore ?? 0}/100)`,
    `- Finance (Interface): ${finance?.profile.soundCategory ?? "n/a"} (${finance?.scores.synchronizationScore ?? 0}/100)`,
    `- Foley (Standalone): ${foley?.profile.soundCategory ?? "n/a"} (${foley?.scores.productionReadinessScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildFoleyReport(...records: (SoundEffectsGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as SoundEffectsGenerationRecord[];
  const lines = [
    "# Foley Planning Report — Step 10F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Category | Foley Types | Footsteps | Realism |",
    "|------|----------|-------------|-----------|---------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.soundPlanId.slice(0, 28)}... | ${r.profile.soundCategory} | ${r.foleyPlan.foleyTypes.join(", ")} | ${r.foleyPlan.footsteps.slice(0, 30)}... | ${r.scores.realismScore}/100 |`
    );
  }
  return lines.join("\n");
}

function buildEnvironmentalReport(...records: (SoundEffectsGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as SoundEffectsGenerationRecord[];
  const lines = [
    "# Environmental Sound Report — Step 10F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Environment | Types | Ambient Layers | Layer Score |",
    "|------|-------------|-------|----------------|-------------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.profile.soundCategory} | ${r.soundAnalysis.environment.slice(0, 25)}... | ${r.environmentalPlan.environmentalTypes.join(", ")} | ${r.environmentalPlan.ambientLayers.length} | ${r.scores.layerQualityScore}/100 |`
    );
  }
  return lines.join("\n");
}

function buildTimelineReport(...records: (SoundEffectsGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as SoundEffectsGenerationRecord[];
  const lines = [
    "# Timeline Planning Report — Step 10F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Cue Points | Duration | Sync Target | Sync Score |",
    "|------|------------|----------|-------------|------------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.profile.platform} | ${r.timelinePlan.cuePoints.length} | ${r.timelinePlan.totalDurationSec}s | ${r.syncPreparation.syncTarget} | ${r.scores.synchronizationScore}/100 |`
    );
  }
  return lines.join("\n");
}

function buildReadinessReport(
  status: SoundEffectsGenerationEngineStatusReport,
  ...records: (SoundEffectsGenerationRecord | undefined)[]
): string {
  const rows = records.filter(Boolean) as SoundEffectsGenerationRecord[];
  return [
    "# Sound Effects Readiness Report — Step 10F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Plan | Realism | Sync | Layers | Brand | Production | Confidence | Ready |",
    "|------|---------|------|--------|-------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.soundCategory} | ${r.scores.realismScore} | ${r.scores.synchronizationScore} | ${r.scores.layerQualityScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- Foley planning: ${status.foleyPlanningStatus}`,
    "",
  ].join("\n");
}

void main();
