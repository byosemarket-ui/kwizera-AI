import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AmbientPlatform,
  AmbientSyncTarget,
  createAiCore,
  CreativePlatform,
  EnvironmentCategory,
  MarketingObjective,
  NATURE_AMBIENCE_TYPES,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  SUPPORTED_ENVIRONMENT_CATEGORIES,
  WEATHER_TYPES,
  type AmbientAudioGenerationEngineStatusReport,
  type AmbientAudioGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-ambient-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step10g-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation",
  features: ["ambient audio", "environmental soundscapes"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2B,
  tags: ["software"],
  keywords: ["kwizera"],
};

const SAMPLE_HEALTH: ProductAnalysisEngineInput = {
  productId: "step10g-health-app",
  productName: "VitalCare Health App",
  category: ProductAnalysisCategory.Health,
  subcategory: "wellness",
  brand: "VitalCare",
  description: "Application de santé pour le bien-être",
  features: ["calm", "wellness"],
  price: 9.99,
  currency: "EUR",
  availability: ProductAvailabilityStatus.InStock,
  industry: "health" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["health"],
  keywords: ["vitalcare"],
};

const SAMPLE_FINANCE: ProductAnalysisEngineInput = {
  productId: "step10g-finance-app",
  productName: "PesaSmart Mobile Banking",
  category: ProductAnalysisCategory.Services,
  subcategory: "mobile-banking",
  brand: "PesaSmart",
  description: "Huduma ya benki ya simu",
  features: ["malipo"],
  price: 0,
  currency: "KES",
  availability: ProductAvailabilityStatus.InStock,
  industry: "general" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["finance"],
  keywords: ["pesasmart"],
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
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: sample.productId! });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: sample.productId!,
    marketingObjective: objective,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({ productId: sample.productId!, platform });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 10G Ambient Audio Generation Engine Validation");
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
    await core.start("step-10g-validation");
    const initMs = Date.now() - initStart;

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const engine = audioFoundation.getAmbientAudioGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Ambient Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = audioFoundation.getRegistry().getModule("ambient-audio-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
    await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);

    const tech = await engine.generateAmbientPlan({
      productId: "step10g-kwizera-pro",
      environmentPrompt: "Modern office indoor ambient with subtle keyboard and room tone",
      platform: AmbientPlatform.YouTube,
      environmentCategory: EnvironmentCategory.Indoor,
      syncTarget: AmbientSyncTarget.Video,
      videoId: "step10g-tech-video",
      durationSec: 120,
      indoorOutdoor: "indoor",
    });

    const health = await engine.generateAmbientPlan({
      productId: "step10g-health-app",
      environmentPrompt: "Calm hospital indoor ambience with peaceful atmosphere",
      platform: AmbientPlatform.Website,
      environmentCategory: EnvironmentCategory.Indoor,
      syncTarget: AmbientSyncTarget.Presentation,
      durationSec: 180,
      weatherHint: "clear",
    });

    const finance = await engine.generateAmbientPlan({
      productId: "step10g-finance-app",
      environmentPrompt: "Busy city market outdoor ambience with traffic and crowd",
      platform: AmbientPlatform.TikTok,
      environmentCategory: EnvironmentCategory.Urban,
      syncTarget: AmbientSyncTarget.Advertisement,
      durationSec: 30,
      geographicContext: "Nairobi, Kenya",
    });

    const nature = await engine.generateAmbientPlan({
      environmentPrompt: "Forest nature ambience with birds, wind and light rain at dawn",
      brandName: "KWIZERA",
      platform: AmbientPlatform.Television,
      environmentCategory: EnvironmentCategory.Nature,
      syncTarget: AmbientSyncTarget.Film,
      durationSec: 240,
      weatherHint: "light rain",
      timeOfDay: "dawn",
    });

    results.ambientPlanGeneration = {
      passed: tech.success && health.success && finance.success && nature.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Nature ${nature.success ? "✓" : "✗"}`,
    };

    results.environmentAnalysis = {
      passed: Boolean(
        tech.record?.environmentAnalysis.environmentType &&
          tech.record?.environmentAnalysis.acousticSpace &&
          tech.record?.environmentAnalysis.intendedMood
      ),
      detail: `${tech.record?.environmentAnalysis.indoorOutdoor}, mood ${tech.record?.environmentAnalysis.intendedMood}`,
    };

    results.ambientPlanning = {
      passed: Boolean(
        nature.record?.ambientSoundPlan.natureAmbience.length >= 1 &&
          (nature.record?.scores.environmentalRealismScore ?? 0) >= 55
      ),
      detail: `${nature.record?.ambientSoundPlan.natureAmbience.length} nature layers, ${NATURE_AMBIENCE_TYPES.length} types supported`,
    };

    results.weatherPlanning = {
      passed: Boolean(
        nature.record?.weatherAmbiencePlan.weatherTypes.length >= 1 &&
          WEATHER_TYPES.length >= 10
      ),
      detail: `Weather: ${nature.record?.weatherAmbiencePlan.primaryWeather}, ${WEATHER_TYPES.length} types supported`,
    };

    results.spatialAudioPlanning = {
      passed: Boolean(
        tech.record?.spatialAudioPlan.surroundPreparation &&
          tech.record?.spatialAudioPlan.binauralPreparation &&
          (tech.record?.scores.spatialAudioScore ?? 0) >= 55
      ),
      detail: `Spatial score ${tech.record?.scores.spatialAudioScore}`,
    };

    results.timelinePlanning = {
      passed: Boolean(
        tech.record?.timelinePlan.cuePoints.length >= 3 &&
          tech.record?.timelinePlan.layerOrder.length >= 2 &&
          tech.record?.timelinePlan.loopPlanning
      ),
      detail: `${tech.record?.timelinePlan.cuePoints.length} cue points, ${tech.record?.timelinePlan.layerOrder.length} layers`,
    };

    results.synchronization = {
      passed: Boolean(
        tech.record?.syncPreparation.hitPoints.length >= 1 &&
          (tech.record?.scores.synchronizationScore ?? 0) >= 55
      ),
      detail: `Sync ${tech.record?.syncPreparation.syncTarget}, score ${tech.record?.scores.synchronizationScore}`,
    };

    results.ambientScores = {
      passed:
        (tech.record?.scores.environmentalRealismScore ?? 0) >= 55 &&
        (tech.record?.scores.immersionScore ?? 0) >= 50 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Realism ${tech.record?.scores.environmentalRealismScore}, immersion ${tech.record?.scores.immersionScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.categorySupport = {
      passed: SUPPORTED_ENVIRONMENT_CATEGORIES.length >= 5,
      detail: `${SUPPORTED_ENVIRONMENT_CATEGORIES.length} environment categories`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.ambientPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.videos.length ?? 0) >= 1,
      detail: `Plans ${tech.record?.relationships.ambientPlans.length}, products ${tech.record?.relationships.products.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noContext = await engine.generateAmbientPlan({ productId: "step10g-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected",
    };

    const promptOnly = await engine.generateAmbientPlan({
      environmentPrompt: "Relaxing ocean ambient for KWIZERA creative workspace background",
      brandName: "KWIZERA",
      platform: AmbientPlatform.Website,
      environmentCategory: EnvironmentCategory.Nature,
    });
    results.promptOnlyGeneration = { passed: promptOnly.success, detail: promptOnly.success ? "Prompt-only plan generated" : "Failed" };

    const repaired = await engine.repairAmbientPlan("step10g-health-app", AmbientPlatform.Facebook);
    results.automaticRepair = { passed: Boolean(repaired?.success), detail: repaired?.success ? "Repair verified" : "Failed" };

    results.searchByProduct = {
      passed: engine.searchAmbientPlans({ productId: "step10g-kwizera-pro" }).length >= 1,
      detail: `${engine.searchAmbientPlans({ productId: "step10g-kwizera-pro" }).length} by product`,
    };
    results.searchByCategory = {
      passed: engine.searchAmbientPlans({ environmentCategory: EnvironmentCategory.Nature }).length >= 1,
      detail: `${engine.searchAmbientPlans({ environmentCategory: EnvironmentCategory.Nature }).length} by category`,
    };
    results.searchByWeather = {
      passed: engine.searchAmbientPlans({ weather: "rain" }).length >= 1,
      detail: `${engine.searchAmbientPlans({ weather: "rain" }).length} by weather`,
    };
    results.searchByKeywords = {
      passed: engine.searchAmbientPlans({ keywords: "kwizera" }).length >= 1,
      detail: `${engine.searchAmbientPlans({ keywords: "kwizera" }).length} by keywords`,
    };

    const ambientAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.ambientPlanId);
    const spatialAsset = audioFoundation.getAssetRegistry().getAsset(`spatial-${tech.record!.ambientPlanId}`);
    results.generationAssetRegistration = {
      passed: ambientAsset?.assetType === "ambient-sound" && spatialAsset?.assetType === "template",
      detail: `Ambient ${ambientAsset?.assetId}, Spatial ${spatialAsset?.assetId}`,
    };

    const blueprint = audioFoundation.getBlueprintManager().getBlueprint(tech.record!.blueprintId!);
    results.blueprintLink = {
      passed: Boolean(blueprint?.blueprintId),
      detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageGenerationMs < 120000,
      detail: `avg ${status.performance.averageGenerationMs}ms`,
    };

    const logFile = path.join(storageRoot, "logs", `ambient-audio-generation-engine-${new Date().toISOString().slice(0, 10)}.jsonl`);
    results.logging = { passed: fs.existsSync(logFile), detail: logFile };

    results.readiness = { passed: status.readinessScore >= 85, detail: `Readiness ${status.readinessScore}/100` };
    results.multiIndustry = {
      passed: health.success && finance.success,
      detail: `Health ${health.record?.profile.environmentCategory}, Finance ${finance.record?.profile.environmentCategory}`,
    };
    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-10g-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Ambient-Audio-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, nature.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Environment-Analysis-Report.md"),
      buildEnvironmentReport(tech.record, health.record, finance.record, nature.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Spatial-Audio-Report.md"),
      buildSpatialReport(tech.record, health.record, finance.record, nature.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Timeline-Planning-Report.md"),
      buildTimelineReport(tech.record, health.record, finance.record, nature.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Ambient-Audio-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, health.record, finance.record, nature.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-10G-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, nature.record),
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
    console.log(`  ${path.join(projectStateDir, "AI-Ambient-Audio-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Environment-Analysis-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Spatial-Audio-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Timeline-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Ambient-Audio-Readiness-Report.md")}`);

    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMainReport(
  status: AmbientAudioGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: AmbientAudioGenerationRecord,
  health?: AmbientAudioGenerationRecord,
  finance?: AmbientAudioGenerationRecord,
  nature?: AmbientAudioGenerationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 10 Step 10G Ambient Audio Generation Report",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
    `**Readiness:** ${status.readinessScore}/100`,
    `**Plans Generated:** ${status.ambientPlansGenerated}`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅" : "❌"} — ${r.detail}`),
    "",
    "## Plans",
    `- Tech (Indoor): ${tech?.scores.environmentalRealismScore ?? 0}/100`,
    `- Health (Indoor): ${health?.scores.immersionScore ?? 0}/100`,
    `- Finance (Urban): ${finance?.scores.spatialAudioScore ?? 0}/100`,
    `- Nature (Forest): ${nature?.scores.productionReadinessScore ?? 0}/100`,
    "",
  ].join("\n");
}

function buildEnvironmentReport(...records: (AmbientAudioGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AmbientAudioGenerationRecord[];
  return [
    "# Environment Analysis Report — Step 10G",
    "",
    "| Plan | Category | Location | Weather | Mood | Indoor/Outdoor |",
    "|------|----------|----------|---------|------|----------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.environmentCategory} | ${r.profile.environmentCategory} | ${r.environmentAnalysis.location.slice(0, 20)} | ${r.environmentAnalysis.weather} | ${r.environmentAnalysis.intendedMood} | ${r.environmentAnalysis.indoorOutdoor} |`
    ),
  ].join("\n");
}

function buildSpatialReport(...records: (AmbientAudioGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AmbientAudioGenerationRecord[];
  return [
    "# Spatial Audio Report — Step 10G",
    "",
    "| Plan | Surround | Binaural | Depth | Spatial Score |",
    "|------|----------|----------|-------|---------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.platform} | ${r.spatialAudioPlan.surroundPreparation.slice(0, 25)}... | ${r.spatialAudioPlan.binauralPreparation.slice(0, 25)}... | ${r.spatialAudioPlan.depth.slice(0, 20)}... | ${r.scores.spatialAudioScore}/100 |`
    ),
  ].join("\n");
}

function buildTimelineReport(...records: (AmbientAudioGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AmbientAudioGenerationRecord[];
  return [
    "# Timeline Planning Report — Step 10G",
    "",
    "| Plan | Cues | Duration | Loop | Sync Score |",
    "|------|------|----------|------|------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.environmentCategory} | ${r.timelinePlan.cuePoints.length} | ${r.timelinePlan.totalDurationSec}s | ${r.timelinePlan.loopPlanning.slice(0, 20)}... | ${r.scores.synchronizationScore}/100 |`
    ),
  ].join("\n");
}

function buildReadinessReport(
  status: AmbientAudioGenerationEngineStatusReport,
  ...records: (AmbientAudioGenerationRecord | undefined)[]
): string {
  const rows = records.filter(Boolean) as AmbientAudioGenerationRecord[];
  return [
    "# Ambient Audio Readiness Report — Step 10G",
    "",
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Plan | Realism | Immersion | Spatial | Sync | Production | Confidence | Ready |",
    "|------|---------|-----------|---------|------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.environmentCategory} | ${r.scores.environmentalRealismScore} | ${r.scores.immersionScore} | ${r.scores.spatialAudioScore} | ${r.scores.synchronizationScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
  ].join("\n");
}

void main();
