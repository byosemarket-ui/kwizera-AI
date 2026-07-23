import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_IMAGE_EDIT_GEN_PLATFORMS,
  ALL_IMAGE_EDIT_IDENTITY_TARGETS,
  ALL_IMAGE_EDIT_INPAINTING_TYPES,
  ALL_IMAGE_EDIT_MASK_TYPES,
  ALL_IMAGE_EDIT_OPERATIONS,
  ALL_IMAGE_EDIT_OUTPAINTING_TYPES,
  BackgroundGenPlatform,
  BackgroundGenType,
  BackgroundMarketingPreset,
  createAiCore,
  CreativePlatform,
  ImageEditGenPlatform,
  ImageEditInpaintingType,
  ImageEditOperationType,
  ImageEditOutpaintingType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  type ImageEditingEngineStatusReport,
  type ImageEditingRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-image-editing-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step9f-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI workstation requiring image editing for marketing",
  features: ["inpainting", "object removal", "brand consistency"],
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
  productId: "step9f-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium jacket for fashion image editing workflows",
  features: ["color editing", "skin retouch planning"],
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
  productId: "step9f-artisan-coffee",
  productName: "Artisan Cold Brew",
  category: ProductAnalysisCategory.Food,
  subcategory: "beverages",
  brand: "BrewCraft",
  description: "Premium cold brew coffee for food photography editing",
  features: ["object removal", "product cleanup"],
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

  console.log("KWIZERA AI STUDIO — Step 9F Image Editing, Inpainting & Outpainting Engine Validation");
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
    await core.start("step-9f-validation");
    const initMs = Date.now() - initStart;

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const productEngine = imgFoundation.getProductImageGenerationEngine();
    const backgroundEngine = imgFoundation.getBackgroundGenerationEngine();
    const engine = imgFoundation.getImageEditingEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Image Editing Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = imgFoundation.getRegistry().getModule("image-editing-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
    await prepareFullPipeline(piFoundation, SAMPLE_FOOD, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);

    const techProduct = await productEngine.generateProductImagePlan({
      productId: "step9f-kwizera-pro",
      platform: ProductImageGenPlatform.Ecommerce,
    });
    const fashionProduct = await productEngine.generateProductImagePlan({
      productId: "step9f-kwizera-jacket",
      platform: ProductImageGenPlatform.Instagram,
    });
    const foodProduct = await productEngine.generateProductImagePlan({
      productId: "step9f-artisan-coffee",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const techBg = await backgroundEngine.generateBackgroundPlan({
      productId: "step9f-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      sourceImageId: techProduct.record!.productImagePlanId,
      platform: BackgroundGenPlatform.Website,
      targetBackground: BackgroundGenType.WhiteBackground,
      marketingPreset: BackgroundMarketingPreset.Electronics,
    });
    const fashionBg = await backgroundEngine.generateBackgroundPlan({
      productId: "step9f-kwizera-jacket",
      productImagePlanId: fashionProduct.record!.productImagePlanId,
      sourceImageId: fashionProduct.record!.productImagePlanId,
      platform: BackgroundGenPlatform.Instagram,
      targetBackground: BackgroundGenType.StudioBackground,
      marketingPreset: BackgroundMarketingPreset.Fashion,
    });
    const foodBg = await backgroundEngine.generateBackgroundPlan({
      productId: "step9f-artisan-coffee",
      productImagePlanId: foodProduct.record!.productImagePlanId,
      sourceImageId: foodProduct.record!.productImagePlanId,
      platform: BackgroundGenPlatform.Catalogue,
      targetBackground: BackgroundGenType.Restaurant,
      marketingPreset: BackgroundMarketingPreset.Food,
    });

    results.upstreamPreparation = {
      passed:
        techProduct.success &&
        fashionProduct.success &&
        foodProduct.success &&
        techBg.success &&
        fashionBg.success &&
        foodBg.success,
      detail: `Product + background plans prepared for all industries`,
    };

    const tech = await engine.generateEditingPlan({
      productId: "step9f-kwizera-pro",
      productImagePlanId: techProduct.record!.productImagePlanId,
      backgroundPlanId: techBg.record!.backgroundPlanId,
      sourceImageId: techProduct.record!.productImagePlanId,
      platform: ImageEditGenPlatform.Website,
      primaryOperation: ImageEditOperationType.ProductCleanup,
      inpaintingType: ImageEditInpaintingType.DetailRecovery,
      outpaintingType: ImageEditOutpaintingType.AspectRatioExpansion,
      editingPrompt: "Clean product edges and remove dust while preserving KWIZERA branding",
      maskIds: ["mask-step9f-tech-subject", "mask-step9f-tech-bg"],
      generatePlatformOptimizations: true,
    });

    const fashion = await engine.generateEditingPlan({
      productId: "step9f-kwizera-jacket",
      productImagePlanId: fashionProduct.record!.productImagePlanId,
      backgroundPlanId: fashionBg.record!.backgroundPlanId,
      sourceImageId: fashionProduct.record!.productImagePlanId,
      platform: ImageEditGenPlatform.Instagram,
      primaryOperation: ImageEditOperationType.ColorEditing,
      inpaintingType: ImageEditInpaintingType.TextureReconstruction,
      outpaintingType: ImageEditOutpaintingType.SceneExtension,
      generatePlatformOptimizations: true,
    });

    const food = await engine.generateEditingPlan({
      productId: "step9f-artisan-coffee",
      productImagePlanId: foodProduct.record!.productImagePlanId,
      backgroundPlanId: foodBg.record!.backgroundPlanId,
      sourceImageId: foodProduct.record!.productImagePlanId,
      platform: ImageEditGenPlatform.Print,
      primaryOperation: ImageEditOperationType.ObjectRemoval,
      inpaintingType: ImageEditInpaintingType.HoleFilling,
      outpaintingType: ImageEditOutpaintingType.PrintExpansion,
      generatePlatformOptimizations: true,
    });

    results.editingPlanGeneration = {
      passed: tech.success && fashion.success && food.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
    };

    results.imageAnalysis = {
      passed: Boolean(
        tech.record?.imageAnalysis.subject &&
          tech.record?.imageAnalysis.composition &&
          tech.record?.imageAnalysis.lighting &&
          tech.record?.imageAnalysis.resolution
      ),
      detail: `Subject analyzed, resolution: ${tech.record?.imageAnalysis.resolution.slice(0, 30)}...`,
    };

    results.editingOperations = {
      passed: (tech.record?.editingOperations.operations.length ?? 0) >= 2,
      detail: `${tech.record?.editingOperations.operations.length} operations planned`,
    };

    results.inpainting = {
      passed: Boolean(
        tech.record?.inpaintingPlan.inpaintingType &&
          tech.record?.inpaintingPlan.reconstructionStrategy &&
          (tech.record?.inpaintingPlan.textureNotes.length ?? 0) >= 2
      ),
      detail: `Type: ${tech.record?.inpaintingPlan.inpaintingType}, score ${tech.record?.scores.reconstructionScore}`,
    };

    results.outpainting = {
      passed: Boolean(
        tech.record?.outpaintingPlan.outpaintingType &&
          tech.record?.outpaintingPlan.expansionRatio &&
          (tech.record?.outpaintingPlan.sceneExtensionNotes.length ?? 0) >= 2
      ),
      detail: `Type: ${tech.record?.outpaintingPlan.outpaintingType}, expansion planned`,
    };

    results.maskManagement = {
      passed:
        (tech.record?.maskManagement.masks.length ?? 0) === ALL_IMAGE_EDIT_MASK_TYPES.length &&
        (tech.record?.maskManagement.protectedRegions.length ?? 0) >= 2,
      detail: `${tech.record?.maskManagement.masks.length}/${ALL_IMAGE_EDIT_MASK_TYPES.length} mask types configured`,
    };

    results.identityPreservation = {
      passed:
        (tech.record?.identityPreservation.targets.length ?? 0) === ALL_IMAGE_EDIT_IDENTITY_TARGETS.length &&
        tech.record?.identityPreservation.identityLock === true &&
        tech.record?.identityPreservation.productLock === true,
      detail: `${tech.record?.identityPreservation.targets.length}/${ALL_IMAGE_EDIT_IDENTITY_TARGETS.length} identity targets locked`,
    };

    results.nonDestructiveEditing = {
      passed:
        tech.record?.nonDestructiveEditing.originalPreserved === true &&
        tech.record?.nonDestructiveEditing.rollbackSupported === true &&
        (tech.record?.nonDestructiveEditing.versionHistory.length ?? 0) >= 1,
      detail: `Version history: ${tech.record?.nonDestructiveEditing.versionHistory.length} entries`,
    };

    results.qualityImprovement = {
      passed: (tech.record?.qualityImprovement.edgeQuality.length ?? 0) >= 10,
      detail: `Edge quality and artifact prevention planned`,
    };

    results.platformOptimization = {
      passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_IMAGE_EDIT_GEN_PLATFORMS.length,
      detail: `${tech.record?.platformOptimizations.length}/${ALL_IMAGE_EDIT_GEN_PLATFORMS.length} platform profiles`,
    };

    results.editingScores = {
      passed:
        (tech.record?.scores.editingQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.identityPreservationScore ?? 0) >= 55 &&
        (tech.record?.scores.reconstructionScore ?? 0) >= 55 &&
        (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Edit ${tech.record?.scores.editingQualityScore}, preservation ${tech.record?.scores.identityPreservationScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.sourceImages.length ?? 0) >= 1 &&
        (tech.record?.relationships.productImagePlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.backgroundPlans.length ?? 0) >= 1,
      detail: `Sources ${tech.record?.relationships.sourceImages.length}, product plans ${tech.record?.relationships.productImagePlans.length}, bg plans ${tech.record?.relationships.backgroundPlans.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noContext = await engine.generateEditingPlan({ productId: "step9f-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected without context",
    };

    const repaired = await engine.repairEditingPlan(techProduct.record!.productImagePlanId, ImageEditGenPlatform.Mobile);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Editing repair verified" : "Repair failed",
    };

    const productSearch = engine.searchEditingPlans({ productId: "step9f-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const opSearch = engine.searchEditingPlans({ primaryOperation: ImageEditOperationType.ProductCleanup });
    results.searchByEditingType = {
      passed: opSearch.length >= 1,
      detail: `${opSearch.length} result(s) by editing type`,
    };

    const keywordSearch = engine.searchEditingPlans({ keywords: "editing" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const editedAsset = imgFoundation.getAssetRegistry().getAsset(tech.record!.profile.editedImageId);
    results.generationAssetRegistration = {
      passed: editedAsset?.assetType === "layer",
      detail: `Edited asset ${editedAsset?.assetId}`,
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
    const logFile = path.join(storageRoot, "logs", `image-editing-engine-${logDate}.jsonl`);
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
      detail: `Fashion ${fashion.record?.profile.primaryOperation}, Food ${food.record?.profile.primaryOperation}`,
    };

    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    results.editingOperationsSupported = {
      passed: ALL_IMAGE_EDIT_OPERATIONS.length >= 10,
      detail: `${ALL_IMAGE_EDIT_OPERATIONS.length} editing operations, ${ALL_IMAGE_EDIT_INPAINTING_TYPES.length} inpainting, ${ALL_IMAGE_EDIT_OUTPAINTING_TYPES.length} outpainting types`,
    };

    await core.stop("step-9f-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Image-Editing-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Inpainting-Report.md"),
      buildInpaintingReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Outpainting-Report.md"),
      buildOutpaintingReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Mask-Management-Report.md"),
      buildMaskReport(tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Image-Editing-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, fashion.record, food.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-9F-VALIDATION-REPORT.md"),
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
    console.log(`  ${path.join(projectStateDir, "AI-Image-Editing-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Inpainting-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Outpainting-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Mask-Management-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Image-Editing-Readiness-Report.md")}`);

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
  status: ImageEditingEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: ImageEditingRecord,
  fashion?: ImageEditingRecord,
  food?: ImageEditingRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 9 Step 9F Image Editing, Inpainting & Outpainting Report",
    "",
    `**Phase:** 9 — Image Generation Engine`,
    `**Step:** 9F — AI Image Editing, Inpainting & Outpainting Engine`,
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
    `| **Editing Plans** | ${status.imageEditingPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Editing Plans",
    "",
    `- Technology: ${tech?.profile.primaryOperation ?? "n/a"} (${tech?.scores.editingQualityScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.primaryOperation ?? "n/a"} (${fashion?.scores.editingQualityScore ?? 0}/100)`,
    `- Food: ${food?.profile.primaryOperation ?? "n/a"} (${food?.scores.editingQualityScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildInpaintingReport(
  tech?: ImageEditingRecord,
  fashion?: ImageEditingRecord,
  food?: ImageEditingRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageEditingRecord[];
  const lines = [
    "# Inpainting Report — Step 9F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Type | Strategy | Texture Notes | Reconstruction Score |",
    "|---------|------|----------|---------------|------------------------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.inpaintingPlan.inpaintingType} | ${record.inpaintingPlan.reconstructionStrategy.slice(0, 30)}... | ${record.inpaintingPlan.textureNotes.length} notes | ${record.scores.reconstructionScore}/100 |`
    );
  }

  return lines.join("\n");
}

function buildOutpaintingReport(
  tech?: ImageEditingRecord,
  fashion?: ImageEditingRecord,
  food?: ImageEditingRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageEditingRecord[];
  const lines = ["# Outpainting Report — Step 9F", "", `**Date:** ${new Date().toISOString()}`, ""];

  for (const record of rows) {
    lines.push(`## ${record.profile.productId}`, "");
    lines.push(`- **Type:** ${record.outpaintingPlan.outpaintingType}`);
    lines.push(`- **Direction:** ${record.outpaintingPlan.expansionDirection}`);
    lines.push(`- **Ratio:** ${record.outpaintingPlan.expansionRatio}`);
    lines.push(`- **Scene Notes:** ${record.outpaintingPlan.sceneExtensionNotes.length} extension notes`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildMaskReport(
  tech?: ImageEditingRecord,
  fashion?: ImageEditingRecord,
  food?: ImageEditingRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageEditingRecord[];
  const lines = [
    "# Mask Management Report — Step 9F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Masks | Protected Regions | Editable | Locked |",
    "|---------|-------|-------------------|----------|--------|",
  ];

  for (const record of rows) {
    const editable = record.maskManagement.masks.filter((m) => m.editable).length;
    const locked = record.maskManagement.masks.filter((m) => m.protected).length;
    lines.push(
      `| ${record.profile.productId} | ${record.maskManagement.masks.length} | ${record.maskManagement.protectedRegions.length} | ${editable} | ${locked} |`
    );
  }

  return lines.join("\n");
}

function buildReadinessReport(
  status: ImageEditingEngineStatusReport,
  tech?: ImageEditingRecord,
  fashion?: ImageEditingRecord,
  food?: ImageEditingRecord
): string {
  const rows = [tech, fashion, food].filter(Boolean) as ImageEditingRecord[];
  return [
    "# Image Editing Readiness Report — Step 9F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Edit Quality | Preservation | Reconstruction | Brand | Production | Confidence | Ready |",
    "|---------|--------------|--------------|----------------|-------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.productId} | ${r.scores.editingQualityScore} | ${r.scores.identityPreservationScore} | ${r.scores.reconstructionScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- ${status.inpaintingStatus}`,
    "",
  ].join("\n");
}

void main();
