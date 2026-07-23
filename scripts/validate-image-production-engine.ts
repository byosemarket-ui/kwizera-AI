import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_IMAGE_PRODUCTION_ASSET_TYPES,
  ALL_IMAGE_PRODUCTION_DEPENDENCIES,
  ALL_IMAGE_PRODUCTION_EXPORT_FORMATS,
  ALL_IMAGE_PRODUCTION_PLATFORMS,
  ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES,
  BrandDesignGenPlatform,
  BrandDesignType,
  createAiCore,
  CreativePlatform,
  ImageProductionPlatform,
  MarketingObjective,
  MultiStyleGenPlatform,
  MultiStyleImageCategory,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  type ImageProductionEngineStatusReport,
  type ImageProductionRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-production-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step9j-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI workstation requiring image production planning",
  features: ["production", "technology visuals"],
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
  productId: "step9j-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium jacket for production planning",
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
  productId: "step9j-artisan-coffee",
  productName: "Artisan Cold Brew",
  category: ProductAnalysisCategory.Food,
  subcategory: "beverages",
  brand: "BrewCraft",
  description: "Premium cold brew for packaging production planning",
  features: ["food photography", "packaging"],
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

  console.log("KWIZERA AI STUDIO — Step 9J Image Production Engine Validation");
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
    await core.start("step-9j-validation");
    const initMs = Date.now() - initStart;

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const productEngine = imgFoundation.getProductImageGenerationEngine();
    const brandingEngine = imgFoundation.getBrandingDesignEngine();
    const styleEngine = imgFoundation.getMultiStyleImageGenerationEngine();
    const engine = imgFoundation.getImageProductionEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Image Production Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = imgFoundation.getRegistry().getModule("image-production-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
    await prepareFullPipeline(piFoundation, SAMPLE_FOOD, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);

    const techProduct = await productEngine.generateProductImagePlan({
      productId: "step9j-kwizera-pro",
      platform: ProductImageGenPlatform.Ecommerce,
    });
    const fashionProduct = await productEngine.generateProductImagePlan({
      productId: "step9j-kwizera-jacket",
      platform: ProductImageGenPlatform.Instagram,
    });
    const foodProduct = await productEngine.generateProductImagePlan({
      productId: "step9j-artisan-coffee",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const techBrand = await brandingEngine.generateBrandingPlan({
      productId: "step9j-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      designType: BrandDesignType.PresentationGraphic,
      platform: BrandDesignGenPlatform.Website,
    });

    const techStyle = await styleEngine.generateStylePlan({
      productId: "step9j-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandingPlanId: techBrand.record!.brandDesignId,
      sourceImageId: techProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      platform: MultiStyleGenPlatform.Website,
      styleCategory: MultiStyleImageCategory.Technology,
      generateVariations: true,
      generatePlatformOptimizations: true,
    });

    const fashionStyle = await styleEngine.generateStylePlan({
      productId: "step9j-kwizera-jacket",
      productImagePlanId: fashionProduct.record!.productImagePlanId,
      sourceImageId: fashionProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      platform: MultiStyleGenPlatform.Instagram,
      styleCategory: MultiStyleImageCategory.Fashion,
      generateVariations: true,
    });

    const foodStyle = await styleEngine.generateStylePlan({
      productId: "step9j-artisan-coffee",
      productImagePlanId: foodProduct.record!.productImagePlanId,
      sourceImageId: foodProduct.record!.productImagePlanId,
      brandId: "BrewCraft",
      platform: MultiStyleGenPlatform.Print,
      styleCategory: MultiStyleImageCategory.FoodPhotography,
      generateVariations: true,
    });

    results.upstreamPreparation = {
      passed:
        techProduct.success &&
        fashionProduct.success &&
        foodProduct.success &&
        techBrand.success &&
        techStyle.success &&
        fashionStyle.success &&
        foodStyle.success,
      detail: "Product, branding, and style plans prepared for all industries",
    };

    const tech = await engine.generateProductionPlan({
      productId: "step9j-kwizera-pro",
      stylePlanId: techStyle.record!.stylePlanId,
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandingPlanId: techBrand.record!.brandDesignId,
      brandId: "KWIZERA",
      platform: ImageProductionPlatform.Website,
      templateIds: ["template-tech-hero"],
      validateAllWorkflows: true,
      validateAllAssets: true,
      prepareExports: true,
      preparePlatformRules: true,
    });

    const fashion = await engine.generateProductionPlan({
      productId: "step9j-kwizera-jacket",
      stylePlanId: fashionStyle.record!.stylePlanId,
      productImagePlanId: fashionProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      platform: ImageProductionPlatform.Instagram,
      prepareExports: true,
      preparePlatformRules: true,
    });

    const food = await engine.generateProductionPlan({
      productId: "step9j-artisan-coffee",
      stylePlanId: foodStyle.record!.stylePlanId,
      productImagePlanId: foodProduct.record!.productImagePlanId,
      brandId: "BrewCraft",
      platform: ImageProductionPlatform.Packaging,
      prepareExports: true,
      preparePlatformRules: true,
    });

    results.productionPlanGeneration = {
      passed: tech.success && fashion.success && food.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
    };

    results.workflowValidation = {
      passed:
        (tech.record?.workflowValidation.length ?? 0) === ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES.length &&
        tech.record?.workflowValidation.every((w) => w.validated) === true,
      detail: `${tech.record?.workflowValidation.filter((w) => w.validated).length}/${ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES.length} workflows validated`,
    };

    results.assetValidation = {
      passed:
        (tech.record?.assetValidation.length ?? 0) === ALL_IMAGE_PRODUCTION_ASSET_TYPES.length &&
        (tech.record?.assetValidation.filter((a) => a.validated).length ?? 0) >= 6,
      detail: `${tech.record?.assetValidation.filter((a) => a.validated).length}/${ALL_IMAGE_PRODUCTION_ASSET_TYPES.length} assets validated`,
    };

    results.dependencyValidation = {
      passed:
        (tech.record?.dependencyValidation.length ?? 0) === ALL_IMAGE_PRODUCTION_DEPENDENCIES.length &&
        tech.record?.dependencyValidation.every((d) => d.available) === true,
      detail: `${tech.record?.dependencyValidation.filter((d) => d.available).length}/${ALL_IMAGE_PRODUCTION_DEPENDENCIES.length} dependencies available`,
    };

    results.layerValidation = {
      passed:
        (tech.record?.productionStructure.layerStructure.length ?? 0) >= 5 &&
        (tech.record?.productionStructure.maskStructure.length ?? 0) >= 2,
      detail: `${tech.record?.productionStructure.layerStructure.length} layers, ${tech.record?.productionStructure.maskStructure.length} masks`,
    };

    results.renderPreparation = {
      passed:
        Boolean(tech.record?.renderPreparation.resolution) &&
        (tech.record?.renderPreparation.dpi ?? 0) >= 72 &&
        (tech.record?.renderPreparation.instructions.length ?? 0) >= 2,
      detail: `${tech.record?.renderPreparation.resolution} @ ${tech.record?.renderPreparation.dpi} DPI`,
    };

    results.exportPreparation = {
      passed:
        (tech.record?.exportPreparation.exports.length ?? 0) === ALL_IMAGE_PRODUCTION_EXPORT_FORMATS.length &&
        tech.record?.exportPreparation.extensibleFormats.length >= 1,
      detail: `${tech.record?.exportPreparation.exports.length} export formats planned`,
    };

    results.productionScores = {
      passed:
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.assetReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.workflowScore ?? 0) >= 55 &&
        (tech.record?.scores.layerIntegrityScore ?? 0) >= 55 &&
        (tech.record?.scores.dependencyScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Readiness ${tech.record?.scores.productionReadinessScore}, workflow ${tech.record?.scores.workflowScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.stylePlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.productImagePlans.length ?? 0) >= 1,
      detail: `Products ${tech.record?.relationships.products.length}, style plans ${tech.record?.relationships.stylePlans.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}`,
    };

    const noContext = await engine.generateProductionPlan({ productId: "step9j-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected without context",
    };

    const repaired = await engine.repairProductionPlan("step9j-kwizera-pro", ImageProductionPlatform.Mobile);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Production repair verified" : "Repair failed",
    };

    const platformSearch = engine.searchProductionPlans({ platform: ImageProductionPlatform.Website });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const productSearch = engine.searchProductionPlans({ productId: "step9j-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const keywordSearch = engine.searchProductionPlans({ keywords: "production" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const productionAsset = imgFoundation.getAssetRegistry().getAsset(tech.record!.imageProductionId);
    results.generationAssetRegistration = {
      passed: productionAsset?.assetType === "render-profile",
      detail: `Production asset ${productionAsset?.assetId}`,
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
    const logFile = path.join(storageRoot, "logs", `image-production-engine-${logDate}.jsonl`);
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

    results.platformOptimization = {
      passed: (tech.record?.platformRules.length ?? 0) === ALL_IMAGE_PRODUCTION_PLATFORMS.length,
      detail: `${tech.record?.platformRules.length}/${ALL_IMAGE_PRODUCTION_PLATFORMS.length} platform rules`,
    };

    await core.stop("step-9j-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Image-Production-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Production-Workflow-Report.md"),
      buildWorkflowReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Asset-Validation-Report.md"),
      buildAssetReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Layer-Validation-Report.md"),
      buildLayerReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Production-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-9J-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record),
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
    console.log(`  ${path.join(projectStateDir, "AI-Image-Production-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Production-Workflow-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Asset-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Layer-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Production-Readiness-Report.md")}`);

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
  status: ImageProductionEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: ImageProductionRecord,
  fashion?: ImageProductionRecord,
  food?: ImageProductionRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 9 Step 9J Image Production Report",
    "",
    `**Phase:** 9 — Image Generation Engine`,
    `**Step:** 9J — AI Image Production Engine`,
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
    `| **Production Plans** | ${status.productionPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Production Plans",
    "",
    `- Technology: ${tech?.profile.platform ?? "n/a"} (${tech?.scores.productionReadinessScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.platform ?? "n/a"} (${fashion?.scores.productionReadinessScore ?? 0}/100)`,
    `- Food: ${food?.profile.platform ?? "n/a"} (${food?.scores.productionReadinessScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildWorkflowReport(
  tech?: ImageProductionRecord,
  fashion?: ImageProductionRecord,
  food?: ImageProductionRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageProductionRecord[];
  const lines = [
    "# Production Workflow Report — Step 9J",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Workflows | Validated | Workflow Score |",
    "|---------|-----------|-----------|----------------|",
  ];

  for (const record of rows) {
    const validated = record.workflowValidation.filter((w) => w.validated).length;
    lines.push(
      `| ${record.profile.productId} | ${record.workflowValidation.length} | ${validated}/${record.workflowValidation.length} | ${record.scores.workflowScore}/100 |`
    );
  }

  return lines.join("\n");
}

function buildAssetReport(
  tech?: ImageProductionRecord,
  fashion?: ImageProductionRecord,
  food?: ImageProductionRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageProductionRecord[];
  const lines = [
    "# Asset Validation Report — Step 9J",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Assets | Validated | Asset Score | Dependencies |",
    "|---------|--------|-----------|-------------|--------------|",
  ];

  for (const record of rows) {
    const validated = record.assetValidation.filter((a) => a.validated).length;
    const deps = record.dependencyValidation.filter((d) => d.available).length;
    lines.push(
      `| ${record.profile.productId} | ${record.assetValidation.length} | ${validated}/${record.assetValidation.length} | ${record.scores.assetReadinessScore}/100 | ${deps}/${record.dependencyValidation.length} |`
    );
  }

  return lines.join("\n");
}

function buildLayerReport(
  tech?: ImageProductionRecord,
  fashion?: ImageProductionRecord,
  food?: ImageProductionRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageProductionRecord[];
  const lines = [
    "# Layer Validation Report — Step 9J",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Layers | Masks | Layer Score | Render Ready |",
    "|---------|--------|-------|-------------|--------------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.productionStructure.layerStructure.length} | ${record.productionStructure.maskStructure.length} | ${record.scores.layerIntegrityScore}/100 | ${record.renderPreparation.instructions.length >= 2 ? "✅" : "❌"} |`
    );
  }

  return lines.join("\n");
}

function buildReadinessReport(
  status: ImageProductionEngineStatusReport,
  tech?: ImageProductionRecord,
  fashion?: ImageProductionRecord,
  food?: ImageProductionRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageProductionRecord[];
  return [
    "# Production Readiness Report — Step 9J",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Readiness | Workflow | Assets | Layers | Dependencies | Confidence | Ready |",
    "|---------|-----------|----------|--------|--------|--------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.productId} | ${r.scores.productionReadinessScore} | ${r.scores.workflowScore} | ${r.scores.assetReadinessScore} | ${r.scores.layerIntegrityScore} | ${r.scores.dependencyScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- ${status.workflowValidationStatus}`,
    "",
  ].join("\n");
}

void main();
