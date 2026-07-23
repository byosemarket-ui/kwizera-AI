import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  CreativePlatform,
  ImageProductionPlatform,
  MarketingObjective,
  MultiStyleImageCategory,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-production-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "production-test-product",
  productName: "Production Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for image production validation",
  features: ["portable", "wireless"],
  specifications: { color: "black" },
  materials: ["plastic", "metal"],
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
    productId: "production-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "production-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "production-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "production-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiImageProductionEngine", () => {
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
    await core.start("production-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getImageProductionEngine();
    const module = foundation.getRegistry().getModule("image-production-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("production-test");
  });

  it("generates production plan from style plan", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("production-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "production-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "production-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      styleCategory: MultiStyleImageCategory.Technology,
      generateVariations: true,
    });

    const engine = foundation.getImageProductionEngine();
    const result = await engine.generateProductionPlan({
      productId: "production-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
      productImagePlanId: productPlan.record!.productImagePlanId,
      platform: ImageProductionPlatform.Website,
      prepareExports: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.productionReadinessScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.workflowValidation.every((w) => w.validated)).toBe(true);
    expect(result.record?.dependencyValidation.every((d) => d.available)).toBe(true);

    await core.stop("production-test");
  });

  it("generates production plan with layer structure and export preparation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("production-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "production-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "production-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      generateVariations: true,
      generatePlatformOptimizations: true,
    });

    const engine = foundation.getImageProductionEngine();
    const result = await engine.generateProductionPlan({
      productId: "production-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
      platform: ImageProductionPlatform.Instagram,
      prepareExports: true,
      preparePlatformRules: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.productionStructure.layerStructure.length).toBeGreaterThanOrEqual(5);
    expect(result.record?.exportPreparation.exports.length).toBeGreaterThanOrEqual(6);
    expect(result.record?.platformRules.length).toBeGreaterThanOrEqual(9);

    await core.stop("production-test");
  });

  it("searches production plans by product and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("production-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "production-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "production-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
    });

    const engine = foundation.getImageProductionEngine();
    await engine.generateProductionPlan({
      productId: "production-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
      platform: ImageProductionPlatform.Website,
    });

    const byProduct = engine.searchProductionPlans({ productId: "production-test-product" });
    const byKeywords = engine.searchProductionPlans({ keywords: "production" });

    expect(byProduct.length).toBeGreaterThanOrEqual(1);
    expect(byKeywords.length).toBeGreaterThanOrEqual(1);

    await core.stop("production-test");
  });
});
