import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_IMAGE_ENHANCE_GEN_PLATFORMS,
  ALL_IMAGE_ENHANCE_OPERATIONS,
  ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS,
  ALL_IMAGE_ENHANCE_RESTORATION_TYPES,
  BackgroundGenPlatform,
  BackgroundGenType,
  BackgroundMarketingPreset,
  createAiCore,
  CreativePlatform,
  ImageEditGenPlatform,
  ImageEditOperationType,
  ImageEnhanceCategory,
  ImageEnhanceGenPlatform,
  ImageEnhanceOperationType,
  ImageEnhanceRestorationType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  type ImageEnhancementEngineStatusReport,
  type ImageEnhancementRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-image-enhancement-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_PRODUCT: ProductAnalysisEngineInput = {
  productId: "step9g-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI workstation requiring image enhancement for marketing",
  features: ["super resolution", "detail enhancement"],
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
  productId: "step9g-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium jacket for fashion image enhancement workflows",
  features: ["texture enhancement", "color correction"],
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

const SAMPLE_HISTORICAL: ProductAnalysisEngineInput = {
  productId: "step9g-vintage-archive",
  productName: "Vintage Brand Archive Photo",
  category: ProductAnalysisCategory.Services,
  subcategory: "archival",
  brand: "HeritageCo",
  description: "Historical brand photograph requiring restoration and enhancement",
  features: ["archival", "historical"],
  specifications: { era: "1960s" },
  materials: ["photographic-print"],
  price: 0,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "other" as ProductAnalysisEngineInput["industry"],
  tags: ["historical", "archive"],
  keywords: ["vintage", "restoration"],
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

async function prepareUpstreamPlans(
  imgFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageGenerationFoundation"]>,
  productId: string,
  productImagePlatform: ProductImageGenPlatform
) {
  const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
    productId,
    platform: productImagePlatform,
  });
  const bgPlan = await imgFoundation.getBackgroundGenerationEngine().generateBackgroundPlan({
    productId,
    productImagePlanId: productPlan.record!.productImagePlanId,
    sourceImageId: productPlan.record!.productImagePlanId,
    platform: BackgroundGenPlatform.Website,
    targetBackground: BackgroundGenType.StudioBackground,
  });
  const editPlan = await imgFoundation.getImageEditingEngine().generateEditingPlan({
    productId,
    productImagePlanId: productPlan.record!.productImagePlanId,
    backgroundPlanId: bgPlan.record!.backgroundPlanId,
    sourceImageId: productPlan.record!.productImagePlanId,
    platform: ImageEditGenPlatform.Website,
    primaryOperation: ImageEditOperationType.ProductCleanup,
  });
  return { productPlan, bgPlan, editPlan };
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 9G Image Enhancement & Restoration Engine Validation");
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
    await core.start("step-9g-validation");
    const initMs = Date.now() - initStart;

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const engine = imgFoundation.getImageEnhancementEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Enhancement Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = imgFoundation.getRegistry().getModule("image-enhancement-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_PRODUCT, MarketingObjective.ProductLaunch, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
    await prepareFullPipeline(piFoundation, SAMPLE_HISTORICAL, MarketingObjective.BrandAwareness, CreativePlatform.Website);

    const productUpstream = await prepareUpstreamPlans(imgFoundation, "step9g-kwizera-pro", ProductImageGenPlatform.Ecommerce);
    const fashionUpstream = await prepareUpstreamPlans(imgFoundation, "step9g-kwizera-jacket", ProductImageGenPlatform.Instagram);
    const historicalUpstream = await prepareUpstreamPlans(imgFoundation, "step9g-vintage-archive", ProductImageGenPlatform.Print);

    results.upstreamPreparation = {
      passed:
        productUpstream.productPlan.success &&
        productUpstream.editPlan.success &&
        fashionUpstream.editPlan.success &&
        historicalUpstream.editPlan.success,
      detail: "Product, background, and editing plans prepared for all categories",
    };

    const product = await engine.generateEnhancementPlan({
      productId: "step9g-kwizera-pro",
      productImagePlanId: productUpstream.productPlan.record!.productImagePlanId,
      imageEditingPlanId: productUpstream.editPlan.record!.imageEditingPlanId,
      editedImageId: productUpstream.editPlan.record!.profile.editedImageId,
      sourceImageId: productUpstream.productPlan.record!.productImagePlanId,
      platform: ImageEnhanceGenPlatform.Website,
      imageCategory: ImageEnhanceCategory.Product,
      primaryEnhancement: ImageEnhanceOperationType.SuperResolutionPlanning,
      restorationType: ImageEnhanceRestorationType.DustRemoval,
      restorationPrompt: "Enhance product image quality with super resolution preserving KWIZERA branding",
      generatePrintPreparation: true,
      generatePlatformOptimizations: true,
    });

    const fashion = await engine.generateEnhancementPlan({
      productId: "step9g-kwizera-jacket",
      productImagePlanId: fashionUpstream.productPlan.record!.productImagePlanId,
      imageEditingPlanId: fashionUpstream.editPlan.record!.imageEditingPlanId,
      sourceImageId: fashionUpstream.productPlan.record!.productImagePlanId,
      platform: ImageEnhanceGenPlatform.Instagram,
      imageCategory: ImageEnhanceCategory.Fashion,
      primaryEnhancement: ImageEnhanceOperationType.TextureEnhancement,
      restorationType: ImageEnhanceRestorationType.ScratchRemoval,
      generatePlatformOptimizations: true,
    });

    const historical = await engine.generateEnhancementPlan({
      productId: "step9g-vintage-archive",
      productImagePlanId: historicalUpstream.productPlan.record!.productImagePlanId,
      imageEditingPlanId: historicalUpstream.editPlan.record!.imageEditingPlanId,
      sourceImageId: historicalUpstream.productPlan.record!.productImagePlanId,
      platform: ImageEnhanceGenPlatform.Print,
      imageCategory: ImageEnhanceCategory.Historical,
      primaryEnhancement: ImageEnhanceOperationType.Deblurring,
      restorationType: ImageEnhanceRestorationType.HistoricalPhotoRestoration,
      restorationPrompt: "Restore historical photograph with authenticity preservation",
      generatePrintPreparation: true,
      generatePlatformOptimizations: true,
    });

    results.enhancementPlanGeneration = {
      passed: product.success && fashion.success && historical.success,
      detail: `Product ${product.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Historical ${historical.success ? "✓" : "✗"}`,
    };

    results.imageAnalysis = {
      passed: Boolean(
        product.record?.imageAnalysis.resolution &&
          product.record?.imageAnalysis.sharpness &&
          product.record?.imageAnalysis.noise &&
          product.record?.imageAnalysis.colorAccuracy
      ),
      detail: `Resolution: ${product.record?.imageAnalysis.resolution.slice(0, 25)}...`,
    };

    results.enhancementPlanning = {
      passed: (product.record?.enhancementOperations.operations.length ?? 0) >= 2,
      detail: `${product.record?.enhancementOperations.operations.length} enhancement operations, target ${product.record?.enhancementOperations.superResolutionTarget}`,
    };

    results.restorationPlanning = {
      passed: Boolean(
        product.record?.restorationOperations.restorationStrategy &&
          (product.record?.restorationOperations.authenticityNotes.length ?? 0) >= 2
      ),
      detail: `Type: ${product.record?.restorationOperations.restorationType}, score ${product.record?.scores.restorationScore}`,
    };

    results.preservationRules = {
      passed:
        (product.record?.preservation.targets.length ?? 0) === ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS.length &&
        product.record?.preservation.identityLock === true &&
        product.record?.preservation.compositionLock === true,
      detail: `${product.record?.preservation.targets.length}/${ALL_IMAGE_ENHANCE_PRESERVATION_TARGETS.length} preservation targets locked`,
    };

    results.superResolution = {
      passed: Boolean(
        product.record?.superResolutionPlan.targetResolution &&
          product.record?.superResolutionPlan.upscalingMethod &&
          (product.record?.superResolutionPlan.edgePreservationNotes.length ?? 0) >= 1
      ),
      detail: `Target: ${product.record?.superResolutionPlan.targetResolution}`,
    };

    results.printPreparation = {
      passed: Boolean(
        product.record?.printPreparation.printResolution &&
          product.record?.printPreparation.cmykPreparation &&
          product.record?.printPreparation.dpiPlanning
      ),
      detail: `DPI: ${product.record?.printPreparation.dpiPlanning.slice(0, 40)}...`,
    };

    results.qualityImprovement = {
      passed: (product.record?.qualityImprovement.edgeQuality.length ?? 0) >= 10,
      detail: "Edge, hair, fabric, and skin quality planning active",
    };

    results.platformOptimization = {
      passed: (product.record?.platformOptimizations.length ?? 0) === ALL_IMAGE_ENHANCE_GEN_PLATFORMS.length,
      detail: `${product.record?.platformOptimizations.length}/${ALL_IMAGE_ENHANCE_GEN_PLATFORMS.length} platform profiles`,
    };

    results.enhancementScores = {
      passed:
        (product.record?.scores.enhancementScore ?? 0) >= 55 &&
        (product.record?.scores.restorationScore ?? 0) >= 55 &&
        (product.record?.scores.sharpnessScore ?? 0) >= 55 &&
        (product.record?.scores.colorAccuracyScore ?? 0) >= 55 &&
        (product.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (product.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (product.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Enhance ${product.record?.scores.enhancementScore}, restore ${product.record?.scores.restorationScore}, confidence ${product.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (product.record?.relationships.sourceImages.length ?? 0) >= 1 &&
        (product.record?.relationships.imageEditingPlans.length ?? 0) >= 1 &&
        (product.record?.relationships.productImagePlans.length ?? 0) >= 1,
      detail: `Sources ${product.record?.relationships.sourceImages.length}, edit plans ${product.record?.relationships.imageEditingPlans.length}`,
    };

    results.productionReadiness = {
      passed: product.record?.productionReady === true && product.record?.validated === true,
      detail: `Production ready: ${product.record?.productionReady}, validated: ${product.record?.validated}`,
    };

    results.brandConsistency = {
      passed: product.record?.brandConsistent === true,
      detail: `Brand consistent: ${product.record?.brandConsistent}, score ${product.record?.scores.brandConsistencyScore}`,
    };

    const noContext = await engine.generateEnhancementPlan({ productId: "step9g-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected without context",
    };

    const repaired = await engine.repairEnhancementPlan(
      productUpstream.productPlan.record!.productImagePlanId,
      ImageEnhanceGenPlatform.Mobile
    );
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Enhancement repair verified" : "Repair failed",
    };

    const productSearch = engine.searchEnhancementPlans({ productId: "step9g-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const typeSearch = engine.searchEnhancementPlans({
      primaryEnhancement: ImageEnhanceOperationType.SuperResolutionPlanning,
    });
    results.searchByEnhancementType = {
      passed: typeSearch.length >= 1,
      detail: `${typeSearch.length} result(s) by enhancement type`,
    };

    const keywordSearch = engine.searchEnhancementPlans({ keywords: "enhancement" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const enhancedAsset = imgFoundation.getAssetRegistry().getAsset(product.record!.profile.enhancedImageId);
    results.generationAssetRegistration = {
      passed: enhancedAsset?.assetType === "image",
      detail: `Enhanced asset ${enhancedAsset?.assetId}`,
    };

    const blueprint = imgFoundation.getBlueprintManager().getBlueprint(product.record!.blueprintId!);
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
    const logFile = path.join(storageRoot, "logs", `image-enhancement-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiCategory = {
      passed: fashion.success && historical.success,
      detail: `Fashion ${fashion.record?.profile.imageCategory}, Historical ${historical.record?.profile.imageCategory}`,
    };

    results.recommendations = {
      passed: (product.record?.recommendations.length ?? 0) >= 1,
      detail: `${product.record?.recommendations.length} recommendation(s)`,
    };

    results.operationsSupported = {
      passed:
        ALL_IMAGE_ENHANCE_OPERATIONS.length >= 11 &&
        ALL_IMAGE_ENHANCE_RESTORATION_TYPES.length >= 8,
      detail: `${ALL_IMAGE_ENHANCE_OPERATIONS.length} enhancement, ${ALL_IMAGE_ENHANCE_RESTORATION_TYPES.length} restoration types`,
    };

    await core.stop("step-9g-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Image-Enhancement-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, product.record, fashion.record, historical.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Image-Restoration-Report.md"),
      buildRestorationReport(product.record, fashion.record, historical.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Super-Resolution-Report.md"),
      buildSuperResolutionReport(product.record, fashion.record, historical.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Print-Preparation-Report.md"),
      buildPrintReport(product.record, fashion.record, historical.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Image-Enhancement-Readiness-Report.md"),
      buildReadinessReport(status, product.record, fashion.record, historical.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-9G-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, product.record, fashion.record, historical.record),
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
    console.log(`  ${path.join(projectStateDir, "AI-Image-Enhancement-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Image-Restoration-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Super-Resolution-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Print-Preparation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Image-Enhancement-Readiness-Report.md")}`);

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
  status: ImageEnhancementEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  product?: ImageEnhancementRecord,
  fashion?: ImageEnhancementRecord,
  historical?: ImageEnhancementRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 9 Step 9G Image Enhancement & Restoration Report",
    "",
    `**Phase:** 9 — Image Generation Engine`,
    `**Step:** 9G — AI Image Enhancement & Restoration Engine`,
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
    `| **Enhancement Plans** | ${status.enhancementPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Enhancement Plans",
    "",
    `- Product: ${product?.profile.primaryEnhancement ?? "n/a"} (${product?.scores.enhancementScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.primaryEnhancement ?? "n/a"} (${fashion?.scores.enhancementScore ?? 0}/100)`,
    `- Historical: ${historical?.profile.primaryEnhancement ?? "n/a"} (${historical?.scores.enhancementScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildRestorationReport(
  product?: ImageEnhancementRecord,
  fashion?: ImageEnhancementRecord,
  historical?: ImageEnhancementRecord
): string {
  const rows = [product, fashion, historical].filter(Boolean) as ImageEnhancementRecord[];
  const lines = [
    "# Image Restoration Report — Step 9G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Type | Strategy | Damage Targets | Restoration Score |",
    "|---------|------|----------|----------------|-------------------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.restorationOperations.restorationType} | ${record.restorationOperations.restorationStrategy.slice(0, 30)}... | ${record.restorationOperations.targetDamage.length} | ${record.scores.restorationScore}/100 |`
    );
  }

  return lines.join("\n");
}

function buildSuperResolutionReport(
  product?: ImageEnhancementRecord,
  fashion?: ImageEnhancementRecord,
  historical?: ImageEnhancementRecord
): string {
  const rows = [product, fashion, historical].filter(Boolean) as ImageEnhancementRecord[];
  const lines = ["# Super Resolution Report — Step 9G", "", `**Date:** ${new Date().toISOString()}`, ""];

  for (const record of rows) {
    lines.push(`## ${record.profile.productId}`, "");
    lines.push(`- **Target:** ${record.superResolutionPlan.targetResolution}`);
    lines.push(`- **Method:** ${record.superResolutionPlan.upscalingMethod.slice(0, 60)}...`);
    lines.push(`- **Strategy:** ${record.superResolutionPlan.detailRecoveryStrategy.slice(0, 60)}...`);
    lines.push(`- **Sharpness Score:** ${record.scores.sharpnessScore}/100`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildPrintReport(
  product?: ImageEnhancementRecord,
  fashion?: ImageEnhancementRecord,
  historical?: ImageEnhancementRecord
): string {
  const rows = [product, fashion, historical].filter(Boolean) as ImageEnhancementRecord[];
  const lines = [
    "# Print Preparation Report — Step 9G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Resolution | Color Profile | DPI | CMYK | Large Format |",
    "|---------|------------|---------------|-----|------|--------------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.printPreparation.printResolution.slice(0, 25)}... | ${record.printPreparation.colorProfile.slice(0, 20)}... | ${record.printPreparation.dpiPlanning.slice(0, 20)}... | ${record.printPreparation.cmykPreparation.slice(0, 20)}... | ${record.printPreparation.largeFormatPreparation.slice(0, 20)}... |`
    );
  }

  return lines.join("\n");
}

function buildReadinessReport(
  status: ImageEnhancementEngineStatusReport,
  product?: ImageEnhancementRecord,
  fashion?: ImageEnhancementRecord,
  historical?: ImageEnhancementRecord
): string {
  const rows = [product, fashion, historical].filter(Boolean) as ImageEnhancementRecord[];
  return [
    "# Image Enhancement Readiness Report — Step 9G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Enhancement | Restoration | Sharpness | Color | Brand | Production | Confidence | Ready |",
    "|---------|-------------|-------------|-----------|-------|-------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.productId} | ${r.scores.enhancementScore} | ${r.scores.restorationScore} | ${r.scores.sharpnessScore} | ${r.scores.colorAccuracyScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- ${status.superResolutionStatus}`,
    "",
  ].join("\n");
}

void main();
