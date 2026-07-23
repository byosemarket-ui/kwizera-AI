import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  CreativePlatform,
  ImageProductionPlatform,
  ImageRenderPlatform,
  MarketingObjective,
  MultiStyleImageCategory,
  OptimizationPlatform,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  QualityValidationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-optimization-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "optimization-test-product",
  productName: "Optimization Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for optimization validation",
  features: ["portable"],
  specifications: { color: "black" },
  materials: ["plastic"],
  price: 99.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.D2C,
  tags: ["test"],
  keywords: ["electronics"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: "optimization-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "optimization-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "optimization-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "optimization-test-product",
    platform: CreativePlatform.Website,
  });
}

async function prepareImagePipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageGenerationFoundation"]>
) {
  const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
    productId: "optimization-test-product",
    platform: ProductImageGenPlatform.Ecommerce,
  });
  const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
    productId: "optimization-test-product",
    productImagePlanId: productPlan.record!.productImagePlanId,
    sourceImageId: productPlan.record!.productImagePlanId,
    styleCategory: MultiStyleImageCategory.Technology,
    generateVariations: true,
  });
  const productionPlan = await foundation.getImageProductionEngine().generateProductionPlan({
    productId: "optimization-test-product",
    stylePlanId: stylePlan.record!.stylePlanId,
    platform: ImageProductionPlatform.Website,
  });
  const renderPlan = await foundation.getImageRenderingPreparationEngine().generateRenderPlan({
    productId: "optimization-test-product",
    productionId: productionPlan.record!.imageProductionId,
    platform: ImageRenderPlatform.Website,
  });
  const validation = await foundation.getImageQualityValidationEngine().validateQuality({
    productId: "optimization-test-product",
    renderPlanId: renderPlan.record!.imageRenderPlanId,
    platform: QualityValidationPlatform.Website,
    autoRepair: true,
  });
  return { productPlan, stylePlan, productionPlan, renderPlan, validation };
}

describe("AiImageGenerationOptimizationEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes and registers with image generation foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("optimization-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getImageGenerationOptimizationEngine();
    const module = foundation.getRegistry().getModule("image-generation-optimization-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("optimization-test");
  });

  it("optimizes image generation from approved validation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("optimization-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);
    const upstream = await prepareImagePipeline(foundation);

    const engine = foundation.getImageGenerationOptimizationEngine();
    const result = await engine.optimizeImageGeneration({
      productId: "optimization-test-product",
      validationId: upstream.validation.record!.qualityValidationId,
      platform: OptimizationPlatform.Website,
      autoRepair: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.optimizationScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.qualityOptimization.qualityMaintainedOrImproved).toBe(true);
    expect(result.record?.componentOptimization.creativeDecisionsPreserved).toBe(true);
    expect(result.record?.approved).toBe(true);

    await core.stop("optimization-test");
  });

  it("optimizes pipeline, resources, and performance", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("optimization-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);
    const upstream = await prepareImagePipeline(foundation);

    const engine = foundation.getImageGenerationOptimizationEngine();
    const result = await engine.optimizeImageGeneration({
      productId: "optimization-test-product",
      validationId: upstream.validation.record!.qualityValidationId,
      optimizePipeline: true,
      optimizeResources: true,
      optimizeSearch: true,
      optimizeRecovery: true,
      autoRepair: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.pipelineOptimization.allPipelineOptimized).toBe(true);
    expect(result.record?.resourceOptimization.allResourcesOptimized).toBe(true);
    expect(result.record?.searchOptimization.allSearchOptimized).toBe(true);
    expect(result.record?.performanceOptimization.allPerformanceOptimized).toBe(true);

    await core.stop("optimization-test");
  });

  it("searches optimizations by score and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("optimization-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);
    const upstream = await prepareImagePipeline(foundation);

    const engine = foundation.getImageGenerationOptimizationEngine();
    await engine.optimizeImageGeneration({
      productId: "optimization-test-product",
      validationId: upstream.validation.record!.qualityValidationId,
      autoRepair: true,
    });

    const byProduct = engine.searchOptimizations({ productId: "optimization-test-product" });
    const byScore = engine.searchOptimizations({ minOptimizationScore: 55 });

    expect(byProduct.length).toBeGreaterThanOrEqual(1);
    expect(byScore.length).toBeGreaterThanOrEqual(1);

    await core.stop("optimization-test");
  });
});
