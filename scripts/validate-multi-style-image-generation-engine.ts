import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_MULTI_STYLE_GEN_PLATFORMS,
  ALL_MULTI_STYLE_IDENTITY_TARGETS,
  ALL_MULTI_STYLE_IMAGE_CATEGORIES,
  ALL_MULTI_STYLE_VARIATION_TYPES,
  BrandDesignType,
  BrandDesignGenPlatform,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  MultiStyleGenPlatform,
  MultiStyleImageCategory,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  type MultiStyleImageEngineStatusReport,
  type MultiStyleImageRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-multi-style-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step9i-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI workstation requiring multi-style image generation",
  features: ["multi-style", "technology visuals"],
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
  productId: "step9i-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium jacket for fashion multi-style generation",
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
  productId: "step9i-artisan-coffee",
  productName: "Artisan Cold Brew",
  category: ProductAnalysisCategory.Food,
  subcategory: "beverages",
  brand: "BrewCraft",
  description: "Premium cold brew for food photography style generation",
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

  console.log("KWIZERA AI STUDIO — Step 9I Multi-Style Image Generation Engine Validation");
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
    await core.start("step-9i-validation");
    const initMs = Date.now() - initStart;

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const productEngine = imgFoundation.getProductImageGenerationEngine();
    const brandingEngine = imgFoundation.getBrandingDesignEngine();
    const engine = imgFoundation.getMultiStyleImageGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Multi-Style Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = imgFoundation.getRegistry().getModule("multi-style-image-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
    await prepareFullPipeline(piFoundation, SAMPLE_FOOD, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);

    const techProduct = await productEngine.generateProductImagePlan({
      productId: "step9i-kwizera-pro",
      platform: ProductImageGenPlatform.Ecommerce,
    });
    const fashionProduct = await productEngine.generateProductImagePlan({
      productId: "step9i-kwizera-jacket",
      platform: ProductImageGenPlatform.Instagram,
    });
    const foodProduct = await productEngine.generateProductImagePlan({
      productId: "step9i-artisan-coffee",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const techBrand = await brandingEngine.generateBrandingPlan({
      productId: "step9i-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      designType: BrandDesignType.PresentationGraphic,
      platform: BrandDesignGenPlatform.Website,
    });

    results.upstreamPreparation = {
      passed: techProduct.success && fashionProduct.success && foodProduct.success && techBrand.success,
      detail: "Product and branding plans prepared for all industries",
    };

    const tech = await engine.generateStylePlan({
      productId: "step9i-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      brandingPlanId: techBrand.record!.brandDesignId,
      sourceImageId: techProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      brandGuidelines: "KWIZERA technology brand — blue palette, modern aesthetic",
      platform: MultiStyleGenPlatform.Website,
      styleCategory: MultiStyleImageCategory.Technology,
      prompt: "Multi-style technology image generation preserving KWIZERA product identity",
      styleReferenceIds: ["style-ref-tech-modern"],
      generateVariations: true,
      generatePlatformOptimizations: true,
    });

    const fashion = await engine.generateStylePlan({
      productId: "step9i-kwizera-jacket",
      productImagePlanId: fashionProduct.record!.productImagePlanId,
      sourceImageId: fashionProduct.record!.productImagePlanId,
      brandId: "KWIZERA",
      platform: MultiStyleGenPlatform.Instagram,
      styleCategory: MultiStyleImageCategory.Fashion,
      generateVariations: true,
      generatePlatformOptimizations: true,
    });

    const food = await engine.generateStylePlan({
      productId: "step9i-artisan-coffee",
      productImagePlanId: foodProduct.record!.productImagePlanId,
      sourceImageId: foodProduct.record!.productImagePlanId,
      brandId: "BrewCraft",
      platform: MultiStyleGenPlatform.Print,
      styleCategory: MultiStyleImageCategory.FoodPhotography,
      generateVariations: true,
      generatePlatformOptimizations: true,
    });

    results.stylePlanGeneration = {
      passed: tech.success && fashion.success && food.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
    };

    results.styleMapping = {
      passed: Boolean(
        tech.record?.styleTransformation.styleMapping &&
          tech.record?.styleTransformation.texturePlanning &&
          tech.record?.styleTransformation.colorAdaptation &&
          tech.record?.styleTransformation.lightingAdaptation
      ),
      detail: `Mapping: ${tech.record?.styleTransformation.styleMapping.slice(0, 35)}...`,
    };

    results.styleTransformation = {
      passed:
        Boolean(tech.record?.styleTransformation.compositionAdaptation) &&
        Boolean(tech.record?.styleTransformation.detailAdaptation) &&
        Boolean(tech.record?.styleTransformation.materialAdaptation),
      detail: "Composition, detail, and material adaptation planned",
    };

    results.identityPreservation = {
      passed:
        (tech.record?.identityPreservation.targets.length ?? 0) === ALL_MULTI_STYLE_IDENTITY_TARGETS.length &&
        tech.record?.identityPreservation.identityLock === true &&
        tech.record?.identityPreservation.productLock === true,
      detail: `${tech.record?.identityPreservation.targets.length}/${ALL_MULTI_STYLE_IDENTITY_TARGETS.length} identity targets locked`,
    };

    results.styleVariations = {
      passed: (tech.record?.styleVariations.variations.length ?? 0) === ALL_MULTI_STYLE_VARIATION_TYPES.length,
      detail: `${tech.record?.styleVariations.variations.length}/${ALL_MULTI_STYLE_VARIATION_TYPES.length} style variations`,
    };

    results.platformOptimization = {
      passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_MULTI_STYLE_GEN_PLATFORMS.length,
      detail: `${tech.record?.platformOptimizations.length}/${ALL_MULTI_STYLE_GEN_PLATFORMS.length} platform profiles`,
    };

    results.styleScores = {
      passed:
        (tech.record?.scores.styleQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.styleAccuracyScore ?? 0) >= 55 &&
        (tech.record?.scores.identityPreservationScore ?? 0) >= 55 &&
        (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Quality ${tech.record?.scores.styleQualityScore}, accuracy ${tech.record?.scores.styleAccuracyScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.brands.length ?? 0) >= 1 &&
        (tech.record?.relationships.productImagePlans.length ?? 0) >= 1,
      detail: `Products ${tech.record?.relationships.products.length}, branding plans ${tech.record?.relationships.brandingPlans.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noContext = await engine.generateStylePlan({ productId: "step9i-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected without context",
    };

    const repaired = await engine.repairStylePlan("step9i-kwizera-pro", MultiStyleGenPlatform.Mobile);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Style repair verified" : "Repair failed",
    };

    const styleSearch = engine.searchStylePlans({ styleCategory: MultiStyleImageCategory.Technology });
    results.searchByStyle = {
      passed: styleSearch.length >= 1,
      detail: `${styleSearch.length} result(s) by style category`,
    };

    const productSearch = engine.searchStylePlans({ productId: "step9i-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const keywordSearch = engine.searchStylePlans({ keywords: "multi-style" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const styleAsset = imgFoundation.getAssetRegistry().getAsset(tech.record!.profile.generatedStyleImageId);
    results.generationAssetRegistration = {
      passed: styleAsset?.assetType === "style",
      detail: `Style asset ${styleAsset?.assetId}`,
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
    const logFile = path.join(storageRoot, "logs", `multi-style-image-generation-engine-${logDate}.jsonl`);
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
      detail: `Fashion ${fashion.record?.profile.styleCategory}, Food ${food.record?.profile.styleCategory}`,
    };

    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    results.styleLibrarySupported = {
      passed: ALL_MULTI_STYLE_IMAGE_CATEGORIES.length >= 32,
      detail: `${ALL_MULTI_STYLE_IMAGE_CATEGORIES.length} styles in library`,
    };

    await core.stop("step-9i-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Multi-Style-Image-Generation-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Style-Mapping-Report.md"),
      buildStyleMappingReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Identity-Preservation-Report.md"),
      buildIdentityReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Style-Validation-Report.md"),
      buildValidationReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Multi-Style-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-9I-VALIDATION-REPORT.md"),
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
    console.log(`  ${path.join(projectStateDir, "AI-Multi-Style-Image-Generation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Style-Mapping-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Identity-Preservation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Style-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Multi-Style-Readiness-Report.md")}`);

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
  status: MultiStyleImageEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: MultiStyleImageRecord,
  fashion?: MultiStyleImageRecord,
  food?: MultiStyleImageRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 9 Step 9I Multi-Style Image Generation Report",
    "",
    `**Phase:** 9 — Image Generation Engine`,
    `**Step:** 9I — AI Multi-Style Image Generation Engine`,
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
    `| **Style Plans** | ${status.stylePlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Style Plans",
    "",
    `- Technology: ${tech?.profile.styleCategory ?? "n/a"} (${tech?.scores.styleQualityScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.styleCategory ?? "n/a"} (${fashion?.scores.styleQualityScore ?? 0}/100)`,
    `- Food: ${food?.profile.styleCategory ?? "n/a"} (${food?.scores.styleQualityScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildStyleMappingReport(
  tech?: MultiStyleImageRecord,
  fashion?: MultiStyleImageRecord,
  food?: MultiStyleImageRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as MultiStyleImageRecord[];
  const lines = [
    "# Style Mapping Report — Step 9I",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Style | Mapping | Color | Lighting | Quality |",
    "|---------|-------|---------|-------|----------|---------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.profile.styleCategory} | ${record.styleTransformation.styleMapping.slice(0, 25)}... | ${record.styleTransformation.colorAdaptation.slice(0, 20)}... | ${record.styleTransformation.lightingAdaptation.slice(0, 20)}... | ${record.scores.styleQualityScore}/100 |`
    );
  }

  return lines.join("\n");
}

function buildIdentityReport(
  tech?: MultiStyleImageRecord,
  fashion?: MultiStyleImageRecord,
  food?: MultiStyleImageRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as MultiStyleImageRecord[];
  const lines = [
    "# Identity Preservation Report — Step 9I",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Targets | Identity Lock | Product Lock | Score |",
    "|---------|---------|---------------|--------------|-------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.identityPreservation.targets.length} | ${record.identityPreservation.identityLock ? "✅" : "❌"} | ${record.identityPreservation.productLock ? "✅" : "❌"} | ${record.scores.identityPreservationScore}/100 |`
    );
  }

  return lines.join("\n");
}

function buildValidationReport(
  tech?: MultiStyleImageRecord,
  fashion?: MultiStyleImageRecord,
  food?: MultiStyleImageRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as MultiStyleImageRecord[];
  const lines = ["# Style Validation Report — Step 9I", "", `**Date:** ${new Date().toISOString()}`, ""];

  for (const record of rows) {
    lines.push(`## ${record.profile.productId}`, "");
    lines.push(`- **Validated:** ${record.validated ? "✅" : "❌"}`);
    lines.push(`- **Variations:** ${record.styleVariations.variations.length}`);
    lines.push(`- **Style Accuracy:** ${record.scores.styleAccuracyScore}/100`);
    lines.push(`- **Brand Consistent:** ${record.brandConsistent ? "✅" : "❌"}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildReadinessReport(
  status: MultiStyleImageEngineStatusReport,
  tech?: MultiStyleImageRecord,
  fashion?: MultiStyleImageRecord,
  food?: MultiStyleImageRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as MultiStyleImageRecord[];
  return [
    "# Multi-Style Readiness Report — Step 9I",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Style Quality | Accuracy | Preservation | Brand | Production | Confidence | Ready |",
    "|---------|---------------|----------|--------------|-------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.productId} | ${r.scores.styleQualityScore} | ${r.scores.styleAccuracyScore} | ${r.scores.identityPreservationScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- ${status.styleLibraryStatus}`,
    "",
  ].join("\n");
}

void main();
