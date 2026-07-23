import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_PIPELINE_OPTIMIZATION_AREAS,
  BrandDesignGenPlatform,
  BrandDesignType,
  createAiCore,
  CreativePlatform,
  ImageProductionPlatform,
  ImageRenderPlatform,
  MarketingObjective,
  MultiStyleGenPlatform,
  MultiStyleImageCategory,
  OptimizationPlatform,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  QualityValidationPlatform,
  type ImageGenerationOptimizationEngineStatusReport,
  type ImageGenerationOptimizationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-optimization-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLES = {
  tech: {
    productId: "step9m-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    brand: "KWIZERA",
    industry: "technology" as ProductAnalysisEngineInput["industry"],
    productionPlatform: ImageProductionPlatform.Website,
    renderPlatform: ImageRenderPlatform.Website,
    qualityPlatform: QualityValidationPlatform.Website,
    optimizationPlatform: OptimizationPlatform.Website,
    styleCategory: MultiStyleImageCategory.Technology,
  },
  fashion: {
    productId: "step9m-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    brand: "KWIZERA",
    industry: "fashion" as ProductAnalysisEngineInput["industry"],
    productionPlatform: ImageProductionPlatform.Instagram,
    renderPlatform: ImageRenderPlatform.Instagram,
    qualityPlatform: QualityValidationPlatform.Instagram,
    optimizationPlatform: OptimizationPlatform.Instagram,
    styleCategory: MultiStyleImageCategory.Fashion,
  },
  food: {
    productId: "step9m-artisan-coffee",
    productName: "Artisan Cold Brew",
    category: ProductAnalysisCategory.Food,
    brand: "BrewCraft",
    industry: "food" as ProductAnalysisEngineInput["industry"],
    productionPlatform: ImageProductionPlatform.Packaging,
    renderPlatform: ImageRenderPlatform.Print,
    qualityPlatform: QualityValidationPlatform.Print,
    optimizationPlatform: OptimizationPlatform.Print,
    styleCategory: MultiStyleImageCategory.FoodPhotography,
  },
};

async function preparePipeline(
  piFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective,
  platform: CreativePlatform
): Promise<void> {
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
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({ productId: sample.productId!, platform });
}

async function prepareFullImagePipeline(
  imgFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageGenerationFoundation"]>,
  key: keyof typeof SAMPLES,
  brandingPlanId?: string
) {
  const s = SAMPLES[key];
  const product = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
    productId: s.productId,
    platform: ProductImageGenPlatform.Ecommerce,
  });
  const style = await imgFoundation.getMultiStyleImageGenerationEngine().generateStylePlan({
    productId: s.productId,
    productImagePlanId: product.record!.productImagePlanId,
    sourceImageId: product.record!.productImagePlanId,
    brandingPlanId,
    brandId: s.brand,
    platform: s.renderPlatform === ImageRenderPlatform.Instagram ? MultiStyleGenPlatform.Instagram : MultiStyleGenPlatform.Website,
    styleCategory: s.styleCategory,
    generateVariations: true,
  });
  const production = await imgFoundation.getImageProductionEngine().generateProductionPlan({
    productId: s.productId,
    stylePlanId: style.record!.stylePlanId,
    productImagePlanId: product.record!.productImagePlanId,
    brandingPlanId,
    brandId: s.brand,
    platform: s.productionPlatform,
    prepareExports: true,
  });
  const render = await imgFoundation.getImageRenderingPreparationEngine().generateRenderPlan({
    productId: s.productId,
    productionId: production.record!.imageProductionId,
    platform: s.renderPlatform,
    prepareOutputProfiles: true,
    generateRenderJobs: true,
  });
  const validation = await imgFoundation.getImageQualityValidationEngine().validateQuality({
    productId: s.productId,
    renderPlanId: render.record!.imageRenderPlanId,
    productionId: production.record!.imageProductionId,
    platform: s.qualityPlatform,
    autoRepair: true,
  });
  return { product, style, production, render, validation };
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 9M Image Generation Optimization Engine Validation");
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
    await core.start("step-9m-validation");
    const initMs = Date.now() - initStart;

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const engine = imgFoundation.getImageGenerationOptimizationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Optimization Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = imgFoundation.getRegistry().getModule("image-generation-optimization-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await preparePipeline(piFoundation, {
      productId: SAMPLES.tech.productId,
      productName: SAMPLES.tech.productName,
      category: SAMPLES.tech.category,
      brand: SAMPLES.tech.brand,
      industry: SAMPLES.tech.industry,
      description: "Tech optimization test",
      features: ["optimization"],
      specifications: {},
      materials: ["digital"],
      price: 299,
      currency: "USD",
      availability: ProductAvailabilityStatus.InStock,
      businessType: ProductBusinessType.B2B,
      tags: ["tech"],
      keywords: ["kwizera"],
    }, MarketingObjective.ProductLaunch, CreativePlatform.Website);

    await preparePipeline(piFoundation, {
      productId: SAMPLES.fashion.productId,
      productName: SAMPLES.fashion.productName,
      category: SAMPLES.fashion.category,
      brand: SAMPLES.fashion.brand,
      industry: SAMPLES.fashion.industry,
      description: "Fashion optimization test",
      features: ["fashion"],
      specifications: {},
      materials: ["cotton"],
      price: 129,
      currency: "USD",
      availability: ProductAvailabilityStatus.InStock,
      businessType: ProductBusinessType.D2C,
      tags: ["fashion"],
      keywords: ["jacket"],
    }, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);

    await preparePipeline(piFoundation, {
      productId: SAMPLES.food.productId,
      productName: SAMPLES.food.productName,
      category: SAMPLES.food.category,
      brand: SAMPLES.food.brand,
      industry: SAMPLES.food.industry,
      description: "Food optimization test",
      features: ["food"],
      specifications: {},
      materials: ["glass"],
      price: 8.99,
      currency: "USD",
      availability: ProductAvailabilityStatus.InStock,
      tags: ["food"],
      keywords: ["coffee"],
    }, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);

    const techBrand = await imgFoundation.getBrandingDesignEngine().generateBrandingPlan({
      productId: SAMPLES.tech.productId,
      brandId: "KWIZERA",
      designType: BrandDesignType.PresentationGraphic,
      platform: BrandDesignGenPlatform.Website,
    });

    const techUpstream = await prepareFullImagePipeline(imgFoundation, "tech", techBrand.record!.brandDesignId);
    const fashionUpstream = await prepareFullImagePipeline(imgFoundation, "fashion");
    const foodUpstream = await prepareFullImagePipeline(imgFoundation, "food");

    results.upstreamPreparation = {
      passed: techUpstream.validation.success && fashionUpstream.validation.success && foodUpstream.validation.success,
      detail: "Approved quality validations prepared for all industries",
    };

    const tech = await engine.optimizeImageGeneration({
      productId: SAMPLES.tech.productId,
      validationId: techUpstream.validation.record!.qualityValidationId,
      renderPlanId: techUpstream.render.record!.imageRenderPlanId,
      productionId: techUpstream.production.record!.imageProductionId,
      platform: OptimizationPlatform.Website,
      autoRepair: true,
      optimizePipeline: true,
      optimizeResources: true,
      optimizeQuality: true,
      optimizeSearch: true,
      optimizeRecovery: true,
    });

    const fashion = await engine.optimizeImageGeneration({
      productId: SAMPLES.fashion.productId,
      validationId: fashionUpstream.validation.record!.qualityValidationId,
      platform: OptimizationPlatform.Instagram,
      autoRepair: true,
    });

    const food = await engine.optimizeImageGeneration({
      productId: SAMPLES.food.productId,
      validationId: foodUpstream.validation.record!.qualityValidationId,
      platform: OptimizationPlatform.Print,
      autoRepair: true,
      optimizePipeline: true,
    });

    results.optimizationGeneration = {
      passed: tech.success && fashion.success && food.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
    };

    results.pipelineOptimization = {
      passed:
        tech.record?.pipelineOptimization.allPipelineOptimized === true &&
        (tech.record?.pipelineOptimization.areas.length ?? 0) === ALL_PIPELINE_OPTIMIZATION_AREAS.length &&
        tech.record?.componentOptimization.creativeDecisionsPreserved === true,
      detail: `${tech.record?.pipelineOptimization.areas.length}/${ALL_PIPELINE_OPTIMIZATION_AREAS.length} pipeline areas optimized`,
    };

    results.resourceOptimization = {
      passed: tech.record?.resourceOptimization.allResourcesOptimized === true,
      detail: `Parallel ${tech.record?.resourceOptimization.parallelProcessing}, cache optimized`,
    };

    results.qualityOptimization = {
      passed:
        tech.record?.qualityOptimization.qualityMaintainedOrImproved === true &&
        tech.record?.qualityOptimization.allQualityOptimized === true,
      detail: "Quality maintained or improved — no degradation",
    };

    results.searchOptimization = {
      passed: tech.record?.searchOptimization.allSearchOptimized === true,
      detail: "Search indexes and cache optimized",
    };

    results.recoveryOptimization = {
      passed: tech.record?.recoveryOptimization.allRecoveryOptimized === true,
      detail: "Recovery checkpoints and rollback enabled",
    };

    results.performanceOptimization = {
      passed: tech.record?.performanceOptimization.allPerformanceOptimized === true,
      detail: tech.record?.performanceOptimization.generationSpeed.slice(0, 40) + "...",
    };

    results.componentOptimization = {
      passed:
        tech.record?.componentOptimization.productionOptimized === true &&
        tech.record?.componentOptimization.renderPreparationOptimized === true &&
        tech.record?.componentOptimization.validationResultsOptimized === true,
      detail: "Production, render, and validation components optimized",
    };

    results.optimizationScores = {
      passed:
        (tech.record?.scores.optimizationScore ?? 0) >= 55 &&
        (tech.record?.scores.performanceScore ?? 0) >= 55 &&
        (tech.record?.scores.resourceEfficiencyScore ?? 0) >= 55 &&
        (tech.record?.scores.qualityImprovementScore ?? 0) >= 55 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Optimization ${tech.record?.scores.optimizationScore}, performance ${tech.record?.scores.performanceScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.validationReports.length ?? 0) >= 1 &&
        (tech.record?.relationships.renderPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1,
      detail: `Validation ${tech.record?.relationships.validationReports.length}, render ${tech.record?.relationships.renderPlans.length}`,
    };

    results.approval = {
      passed: tech.record?.approved === true && tech.record?.validated === true,
      detail: `Approved: ${tech.record?.approved}, validated: ${tech.record?.validated}`,
    };

    const noContext = await engine.optimizeImageGeneration({ productId: "step9m-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected without approved validation",
    };

    const repaired = await engine.repairAndReoptimize(SAMPLES.tech.productId, OptimizationPlatform.Mobile);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? `Repair verified, ${repaired.record?.repairsApplied.length ?? 0} repair(s)` : "Repair failed",
    };

    const reoptimized = await engine.optimizeImageGeneration({
      productId: SAMPLES.tech.productId,
      validationId: techUpstream.validation.record!.qualityValidationId,
      platform: OptimizationPlatform.Website,
      autoRepair: true,
    });
    results.revalidation = {
      passed: reoptimized.success && reoptimized.record?.approved === true,
      detail: reoptimized.success ? "Re-optimization passed after repair" : "Re-optimization failed",
    };

    const scoreSearch = engine.searchOptimizations({ minOptimizationScore: 55 });
    results.searchByOptimizationScore = {
      passed: scoreSearch.length >= 1,
      detail: `${scoreSearch.length} result(s) by optimization score`,
    };

    const productSearch = engine.searchOptimizations({ productId: SAMPLES.tech.productId });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const keywordSearch = engine.searchOptimizations({ keywords: "optimization" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const optAsset = imgFoundation.getAssetRegistry().getAsset(tech.record!.optimizationId);
    results.generationAssetRegistration = {
      passed: optAsset?.assetType === "render-profile",
      detail: `Optimization asset ${optAsset?.assetId}`,
    };

    const blueprint = imgFoundation.getBlueprintManager().getBlueprint(tech.record!.blueprintId!);
    results.blueprintLink = {
      passed: Boolean(blueprint?.blueprintId),
      detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageOptimizationMs < 120000,
      detail: `avg optimization ${status.performance.averageOptimizationMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `image-generation-optimization-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiIndustry = {
      passed: fashion.success && food.success,
      detail: `Fashion ${fashion.record?.profile.platform}, Food ${food.record?.profile.platform}`,
    };

    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-9m-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(path.join(projectStateDir, "AI-Image-Generation-Optimization-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Pipeline-Optimization-Report.md"), buildPipelineReport(tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Performance-Optimization-Report.md"), buildPerformanceReport(tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Resource-Optimization-Report.md"), buildResourceReport(tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Production-Optimization-Report.md"), buildProductionReport(status, tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(process.cwd(), "STEP-9M-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);
    console.log("Reports written:");
    console.log(`  ${path.join(projectStateDir, "AI-Image-Generation-Optimization-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Pipeline-Optimization-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Performance-Optimization-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Resource-Optimization-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Production-Optimization-Report.md")}`);

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
  status: ImageGenerationOptimizationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: ImageGenerationOptimizationRecord,
  fashion?: ImageGenerationOptimizationRecord,
  food?: ImageGenerationOptimizationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 9 Step 9M Image Generation Optimization Report",
    "",
    `**Phase:** 9 — Image Generation Engine`,
    `**Step:** 9M — AI Image Generation Optimization Engine`,
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
    `| **Optimizations** | ${status.optimizationsPerformed} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Optimizations",
    "",
    `- Technology: ${tech?.profile.platform ?? "n/a"} (${tech?.scores.optimizationScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.platform ?? "n/a"} (${fashion?.scores.optimizationScore ?? 0}/100)`,
    `- Food/Print: ${food?.profile.platform ?? "n/a"} (${food?.scores.optimizationScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildPipelineReport(tech?: ImageGenerationOptimizationRecord, fashion?: ImageGenerationOptimizationRecord, food?: ImageGenerationOptimizationRecord): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageGenerationOptimizationRecord[];
  const lines = ["# Pipeline Optimization Report — Step 9M", "", `**Date:** ${new Date().toISOString()}`, "", "| Product | Pipeline Areas | Components | Creative Preserved | Score |", "|---------|----------------|------------|---------------------|-------|"];
  for (const r of rows) {
    lines.push(`| ${r.profile.productId} | ${r.pipelineOptimization.areas.length} | 12 | ${r.componentOptimization.creativeDecisionsPreserved ? "✅" : "❌"} | ${r.scores.optimizationScore}/100 |`);
  }
  return lines.join("\n");
}

function buildPerformanceReport(tech?: ImageGenerationOptimizationRecord, fashion?: ImageGenerationOptimizationRecord, food?: ImageGenerationOptimizationRecord): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageGenerationOptimizationRecord[];
  const lines = ["# Performance Optimization Report — Step 9M", "", `**Date:** ${new Date().toISOString()}`, "", "| Product | Performance | Optimization | Quality Improvement | Approved |", "|---------|-------------|--------------|---------------------|----------|"];
  for (const r of rows) {
    lines.push(`| ${r.profile.productId} | ${r.scores.performanceScore}/100 | ${r.scores.optimizationScore}/100 | ${r.scores.qualityImprovementScore}/100 | ${r.approved ? "✅" : "❌"} |`);
  }
  return lines.join("\n");
}

function buildResourceReport(tech?: ImageGenerationOptimizationRecord, fashion?: ImageGenerationOptimizationRecord, food?: ImageGenerationOptimizationRecord): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageGenerationOptimizationRecord[];
  const lines = ["# Resource Optimization Report — Step 9M", "", `**Date:** ${new Date().toISOString()}`, "", "| Product | Resource Efficiency | Parallel | Cache | Recovery |", "|---------|-------------------|----------|-------|----------|"];
  for (const r of rows) {
    lines.push(`| ${r.profile.productId} | ${r.scores.resourceEfficiencyScore}/100 | ${r.resourceOptimization.parallelProcessing ? "✅" : "❌"} | ${r.resourceOptimization.cacheUsage.slice(0, 25)}... | ${r.recoveryOptimization.allRecoveryOptimized ? "✅" : "❌"} |`);
  }
  return lines.join("\n");
}

function buildProductionReport(
  status: ImageGenerationOptimizationEngineStatusReport,
  tech?: ImageGenerationOptimizationRecord,
  fashion?: ImageGenerationOptimizationRecord,
  food?: ImageGenerationOptimizationRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageGenerationOptimizationRecord[];
  return [
    "# Production Optimization Report — Step 9M",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Production Ready | Readiness Score | Confidence | Quality Maintained |",
    "|---------|------------------|-----------------|------------|-------------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.productId} | ${r.productionReady ? "✅" : "❌"} | ${r.scores.productionReadinessScore}/100 | ${r.scores.aiConfidenceScore}/100 | ${r.qualityOptimization.qualityMaintainedOrImproved ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average optimization: ${status.performance.averageOptimizationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- ${status.qualityOptimizationStatus}`,
    "",
  ].join("\n");
}

void main();
