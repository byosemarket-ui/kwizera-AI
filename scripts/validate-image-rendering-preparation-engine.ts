import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_IMAGE_RENDER_ASSET_TYPES,
  ALL_IMAGE_RENDER_LAYER_CHECKS,
  ALL_IMAGE_RENDER_MASK_TYPES,
  ALL_IMAGE_RENDER_PLATFORMS,
  ALL_IMAGE_RENDER_VALIDATION_STAGES,
  BrandDesignGenPlatform,
  BrandDesignType,
  createAiCore,
  CreativePlatform,
  ImageProductionPlatform,
  ImageRenderColorSpace,
  ImageRenderPlatform,
  MarketingObjective,
  MultiStyleGenPlatform,
  MultiStyleImageCategory,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  type ImageRenderEngineStatusReport,
  type ImageRenderRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-render-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step9k-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI workstation requiring render preparation",
  features: ["rendering", "technology visuals"],
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
  productId: "step9k-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium jacket for render preparation",
  features: ["editorial", "lifestyle"],
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

const SAMPLE_FOOD: ProductAnalysisEngineInput = {
  productId: "step9k-artisan-coffee",
  productName: "Artisan Cold Brew",
  category: ProductAnalysisCategory.Food,
  subcategory: "beverages",
  brand: "BrewCraft",
  description: "Premium cold brew for catalogue render preparation",
  features: ["food photography", "catalogue"],
  specifications: { volume: "500ml" },
  materials: ["glass-bottle"],
  price: 8.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "food" as ProductAnalysisEngineInput["industry"],
  tags: ["food"],
  keywords: ["coffee"],
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

  console.log("KWIZERA AI STUDIO — Step 9K Image Rendering Preparation Engine Validation");
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
    await core.start("step-9k-validation");
    const initMs = Date.now() - initStart;

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const productEngine = imgFoundation.getProductImageGenerationEngine();
    const brandingEngine = imgFoundation.getBrandingDesignEngine();
    const styleEngine = imgFoundation.getMultiStyleImageGenerationEngine();
    const productionEngine = imgFoundation.getImageProductionEngine();
    const engine = imgFoundation.getImageRenderingPreparationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Rendering Preparation Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = imgFoundation.getRegistry().getModule("image-rendering-preparation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
    await prepareFullPipeline(piFoundation, SAMPLE_FOOD, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);

    const techProduct = await productEngine.generateProductImagePlan({ productId: "step9k-kwizera-pro", platform: ProductImageGenPlatform.Ecommerce });
    const fashionProduct = await productEngine.generateProductImagePlan({ productId: "step9k-kwizera-jacket", platform: ProductImageGenPlatform.Instagram });
    const foodProduct = await productEngine.generateProductImagePlan({ productId: "step9k-artisan-coffee", platform: ProductImageGenPlatform.Ecommerce });

    const techBrand = await brandingEngine.generateBrandingPlan({
      productId: "step9k-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      designType: BrandDesignType.PresentationGraphic,
      platform: BrandDesignGenPlatform.Website,
    });

    const techStyle = await styleEngine.generateStylePlan({
      productId: "step9k-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandingPlanId: techBrand.record!.brandDesignId,
      sourceImageId: techProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      platform: MultiStyleGenPlatform.Website,
      styleCategory: MultiStyleImageCategory.Technology,
      generateVariations: true,
    });

    const fashionStyle = await styleEngine.generateStylePlan({
      productId: "step9k-kwizera-jacket",
      productImagePlanId: fashionProduct.record!.productImagePlanId,
      sourceImageId: fashionProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      platform: MultiStyleGenPlatform.Instagram,
      styleCategory: MultiStyleImageCategory.Fashion,
      generateVariations: true,
    });

    const foodStyle = await styleEngine.generateStylePlan({
      productId: "step9k-artisan-coffee",
      productImagePlanId: foodProduct.record!.productImagePlanId,
      sourceImageId: foodProduct.record!.productImagePlanId,
      brandId: "BrewCraft",
      platform: MultiStyleGenPlatform.Print,
      styleCategory: MultiStyleImageCategory.FoodPhotography,
      generateVariations: true,
    });

    const techProduction = await productionEngine.generateProductionPlan({
      productId: "step9k-kwizera-pro",
      stylePlanId: techStyle.record!.stylePlanId,
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandingPlanId: techBrand.record!.brandDesignId,
      brandId: "KWIZERA",
      platform: ImageProductionPlatform.Website,
      prepareExports: true,
      preparePlatformRules: true,
    });

    const fashionProduction = await productionEngine.generateProductionPlan({
      productId: "step9k-kwizera-jacket",
      stylePlanId: fashionStyle.record!.stylePlanId,
      productImagePlanId: fashionProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      platform: ImageProductionPlatform.Instagram,
      prepareExports: true,
    });

    const foodProduction = await productionEngine.generateProductionPlan({
      productId: "step9k-artisan-coffee",
      stylePlanId: foodStyle.record!.stylePlanId,
      productImagePlanId: foodProduct.record!.productImagePlanId,
      brandId: "BrewCraft",
      platform: ImageProductionPlatform.Packaging,
      prepareExports: true,
    });

    results.upstreamPreparation = {
      passed:
        techProduction.success && fashionProduction.success && foodProduction.success,
      detail: "Production plans prepared for all industries",
    };

    const tech = await engine.generateRenderPlan({
      productId: "step9k-kwizera-pro",
      productionId: techProduction.record!.imageProductionId,
      stylePlanId: techStyle.record!.stylePlanId,
      brandId: "KWIZERA",
      platform: ImageRenderPlatform.Website,
      templateIds: ["template-tech-render"],
      validateLayers: true,
      validateMasks: true,
      validateAssets: true,
      planResources: true,
      prepareOutputProfiles: true,
      generateRenderJobs: true,
    });

    const fashion = await engine.generateRenderPlan({
      productId: "step9k-kwizera-jacket",
      productionId: fashionProduction.record!.imageProductionId,
      platform: ImageRenderPlatform.Instagram,
      prepareOutputProfiles: true,
      generateRenderJobs: true,
    });

    const food = await engine.generateRenderPlan({
      productId: "step9k-artisan-coffee",
      productionId: foodProduction.record!.imageProductionId,
      platform: ImageRenderPlatform.Catalogue,
      prepareOutputProfiles: true,
      generateRenderJobs: true,
    });

    results.renderPlanGeneration = {
      passed: tech.success && fashion.success && food.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
    };

    results.renderValidation = {
      passed:
        (tech.record?.renderValidation.length ?? 0) === ALL_IMAGE_RENDER_VALIDATION_STAGES.length &&
        tech.record?.renderValidation.every((v) => v.validated) === true,
      detail: `${tech.record?.renderValidation.filter((v) => v.validated).length}/${ALL_IMAGE_RENDER_VALIDATION_STAGES.length} render stages validated`,
    };

    results.layerValidation = {
      passed:
        (tech.record?.layerValidation.length ?? 0) === ALL_IMAGE_RENDER_LAYER_CHECKS.length &&
        tech.record?.layerValidation.every((l) => l.validated) === true,
      detail: `${tech.record?.layerValidation.filter((l) => l.validated).length}/${ALL_IMAGE_RENDER_LAYER_CHECKS.length} layer checks passed`,
    };

    results.maskValidation = {
      passed:
        (tech.record?.maskValidation.length ?? 0) === ALL_IMAGE_RENDER_MASK_TYPES.length &&
        tech.record?.maskValidation.every((m) => m.validated) === true,
      detail: `${tech.record?.maskValidation.filter((m) => m.validated).length}/${ALL_IMAGE_RENDER_MASK_TYPES.length} masks validated`,
    };

    results.assetValidation = {
      passed:
        (tech.record?.assetValidation.length ?? 0) === ALL_IMAGE_RENDER_ASSET_TYPES.length &&
        (tech.record?.assetValidation.filter((a) => a.validated).length ?? 0) >= 8,
      detail: `${tech.record?.assetValidation.filter((a) => a.validated).length}/${ALL_IMAGE_RENDER_ASSET_TYPES.length} assets validated`,
    };

    results.renderSettings = {
      passed:
        Boolean(tech.record?.renderSettings.resolution) &&
        (tech.record?.renderSettings.dpi ?? 0) >= 72 &&
        Boolean(tech.record?.renderSettings.iccProfile) &&
        (tech.record?.renderSettings.instructions.length ?? 0) >= 2,
      detail: `${tech.record?.renderSettings.resolution} @ ${tech.record?.renderSettings.dpi} DPI, ${tech.record?.renderSettings.colorSpace}`,
    };

    results.resourcePlanning = {
      passed:
        Boolean(tech.record?.resourcePlanning.cpuAllocation) &&
        Boolean(tech.record?.resourcePlanning.gpuAllocation) &&
        (tech.record?.resourcePlanning.renderQueue.length ?? 0) >= 1,
      detail: `Queue ${tech.record?.resourcePlanning.renderQueue.length}, parallel ${tech.record?.resourcePlanning.parallelRenderingPreparation}`,
    };

    results.renderScores = {
      passed:
        (tech.record?.scores.renderReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.assetQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.layerIntegrityScore ?? 0) >= 55 &&
        (tech.record?.scores.maskIntegrityScore ?? 0) >= 55 &&
        (tech.record?.scores.platformCompatibilityScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Readiness ${tech.record?.scores.renderReadinessScore}, layer ${tech.record?.scores.layerIntegrityScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.productionPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.renderPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1,
      detail: `Production ${tech.record?.relationships.productionPlans.length}, render ${tech.record?.relationships.renderPlans.length}`,
    };

    results.renderReadiness = {
      passed: tech.record?.renderReady === true && tech.record?.validated === true,
      detail: `Render ready: ${tech.record?.renderReady}, validated: ${tech.record?.validated}`,
    };

    results.recoveryPlanning = {
      passed:
        (tech.record?.recoveryPlan.checkpoints.length ?? 0) >= 2 &&
        tech.record?.recoveryPlan.automaticRecovery === true,
      detail: `${tech.record?.recoveryPlan.checkpoints.length} checkpoints, auto-recovery enabled`,
    };

    const noContext = await engine.generateRenderPlan({ productId: "step9k-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected without context",
    };

    const repaired = await engine.repairRenderPlan("step9k-kwizera-pro", ImageRenderPlatform.Mobile);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Render repair verified" : "Repair failed",
    };

    const platformSearch = engine.searchRenderPlans({ platform: ImageRenderPlatform.Website });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const resolutionSearch = engine.searchRenderPlans({ resolution: "1920" });
    results.searchByResolution = {
      passed: resolutionSearch.length >= 1,
      detail: `${resolutionSearch.length} result(s) by resolution`,
    };

    const colorSearch = engine.searchRenderPlans({ colorSpace: ImageRenderColorSpace.Rgb });
    results.searchByColorSpace = {
      passed: colorSearch.length >= 1,
      detail: `${colorSearch.length} result(s) by color space`,
    };

    const keywordSearch = engine.searchRenderPlans({ keywords: "render" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const renderAsset = imgFoundation.getAssetRegistry().getAsset(tech.record!.imageRenderPlanId);
    results.generationAssetRegistration = {
      passed: renderAsset?.assetType === "render-profile",
      detail: `Render asset ${renderAsset?.assetId}`,
    };

    const blueprint = imgFoundation.getBlueprintManager().getBlueprint(tech.record!.blueprintId!);
    results.blueprintLink = {
      passed: Boolean(blueprint?.blueprintId),
      detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageGenerationMs < 120000,
      detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `image-rendering-preparation-engine-${logDate}.jsonl`);
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

    results.outputProfiles = {
      passed: (tech.record?.outputProfiles.length ?? 0) === ALL_IMAGE_RENDER_PLATFORMS.length,
      detail: `${tech.record?.outputProfiles.length}/${ALL_IMAGE_RENDER_PLATFORMS.length} output profiles`,
    };

    results.renderJobs = {
      passed: (tech.record?.renderJobs.length ?? 0) >= 1,
      detail: `${tech.record?.renderJobs.length} render job(s) prepared`,
    };

    await core.stop("step-9k-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(path.join(projectStateDir, "AI-Image-Rendering-Preparation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Render-Profile-Report.md"), buildRenderProfileReport(tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Layer-Integrity-Report.md"), buildLayerReport(tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Mask-Integrity-Report.md"), buildMaskReport(tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(projectStateDir, "Rendering-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, food.record), "utf8");
    fs.writeFileSync(path.join(process.cwd(), "STEP-9K-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);
    console.log("Reports written:");
    console.log(`  ${path.join(projectStateDir, "AI-Image-Rendering-Preparation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Render-Profile-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Layer-Integrity-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Mask-Integrity-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Rendering-Readiness-Report.md")}`);

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
  status: ImageRenderEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: ImageRenderRecord,
  fashion?: ImageRenderRecord,
  food?: ImageRenderRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 9 Step 9K Image Rendering Preparation Report",
    "",
    `**Phase:** 9 — Image Generation Engine`,
    `**Step:** 9K — AI Image Rendering Preparation Engine`,
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
    `| **Render Plans** | ${status.renderPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Render Plans",
    "",
    `- Technology: ${tech?.profile.platform ?? "n/a"} (${tech?.scores.renderReadinessScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.platform ?? "n/a"} (${fashion?.scores.renderReadinessScore ?? 0}/100)`,
    `- Food: ${food?.profile.platform ?? "n/a"} (${food?.scores.renderReadinessScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildRenderProfileReport(tech?: ImageRenderRecord, fashion?: ImageRenderRecord, food?: ImageRenderRecord): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageRenderRecord[];
  const lines = [
    "# Render Profile Report — Step 9K",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Platform | Resolution | DPI | Color Space | Bit Depth | Alpha |",
    "|---------|----------|------------|-----|-------------|-----------|-------|",
  ];
  for (const record of rows) {
    lines.push(
      `| ${record.relationships.products[0] ?? "n/a"} | ${record.profile.platform} | ${record.renderSettings.resolution} | ${record.renderSettings.dpi} | ${record.renderSettings.colorSpace} | ${record.renderSettings.bitDepth} | ${record.renderSettings.alphaChannel ? "✅" : "❌"} |`
    );
  }
  return lines.join("\n");
}

function buildLayerReport(tech?: ImageRenderRecord, fashion?: ImageRenderRecord, food?: ImageRenderRecord): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageRenderRecord[];
  const lines = [
    "# Layer Integrity Report — Step 9K",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Layers | Checks | Layer Score | Ready |",
    "|---------|--------|--------|-------------|-------|",
  ];
  for (const record of rows) {
    const checks = record.layerValidation.filter((l) => l.validated).length;
    lines.push(
      `| ${record.relationships.products[0] ?? "n/a"} | ${record.layerStructure.length} | ${checks}/${record.layerValidation.length} | ${record.scores.layerIntegrityScore}/100 | ${record.renderReady ? "✅" : "❌"} |`
    );
  }
  return lines.join("\n");
}

function buildMaskReport(tech?: ImageRenderRecord, fashion?: ImageRenderRecord, food?: ImageRenderRecord): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageRenderRecord[];
  const lines = [
    "# Mask Integrity Report — Step 9K",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Masks | Validated | Mask Score |",
    "|---------|-------|-----------|------------|",
  ];
  for (const record of rows) {
    const validated = record.maskValidation.filter((m) => m.validated).length;
    lines.push(
      `| ${record.relationships.products[0] ?? "n/a"} | ${record.maskValidation.length} | ${validated}/${record.maskValidation.length} | ${record.scores.maskIntegrityScore}/100 |`
    );
  }
  return lines.join("\n");
}

function buildReadinessReport(
  status: ImageRenderEngineStatusReport,
  tech?: ImageRenderRecord,
  fashion?: ImageRenderRecord,
  food?: ImageRenderRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageRenderRecord[];
  return [
    "# Rendering Readiness Report — Step 9K",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Render Ready | Readiness | Assets | Layers | Masks | Platform | Performance | Confidence |",
    "|---------|--------------|-----------|--------|--------|-------|----------|-------------|------------|",
    ...rows.map(
      (r) =>
        `| ${r.relationships.products[0] ?? "n/a"} | ${r.renderReady ? "✅" : "❌"} | ${r.scores.renderReadinessScore} | ${r.scores.assetQualityScore} | ${r.scores.layerIntegrityScore} | ${r.scores.maskIntegrityScore} | ${r.scores.platformCompatibilityScore} | ${r.scores.performanceScore} | ${r.scores.aiConfidenceScore} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- ${status.renderValidationStatus}`,
    "",
  ].join("\n");
}

void main();
