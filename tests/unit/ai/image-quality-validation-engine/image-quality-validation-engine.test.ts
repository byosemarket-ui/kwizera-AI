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
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  QualityValidationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-quality-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "quality-test-product",
  productName: "Quality Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for quality validation",
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
    productId: "quality-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "quality-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "quality-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "quality-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiImageQualityValidationEngine", () => {
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
    await core.start("quality-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getImageQualityValidationEngine();
    const module = foundation.getRegistry().getModule("image-quality-validation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("quality-test");
  });

  it("validates quality from render and production plans", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("quality-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "quality-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "quality-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      styleCategory: MultiStyleImageCategory.Technology,
      generateVariations: true,
    });

    const productionPlan = await foundation.getImageProductionEngine().generateProductionPlan({
      productId: "quality-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
      platform: ImageProductionPlatform.Website,
    });

    const renderPlan = await foundation.getImageRenderingPreparationEngine().generateRenderPlan({
      productId: "quality-test-product",
      productionId: productionPlan.record!.imageProductionId,
      platform: ImageRenderPlatform.Website,
    });

    const engine = foundation.getImageQualityValidationEngine();
    const result = await engine.validateQuality({
      productId: "quality-test-product",
      renderPlanId: renderPlan.record!.imageRenderPlanId,
      productionId: productionPlan.record!.imageProductionId,
      platform: QualityValidationPlatform.Website,
      autoRepair: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.overallQualityScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.approved).toBe(true);
    expect(result.record?.imageQuality.every((e) => e.validated)).toBe(true);

    await core.stop("quality-test");
  });

  it("validates brand and print readiness with issue detection", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("quality-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "quality-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "quality-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      generateVariations: true,
    });

    const productionPlan = await foundation.getImageProductionEngine().generateProductionPlan({
      productId: "quality-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
      platform: ImageProductionPlatform.Print,
    });

    const renderPlan = await foundation.getImageRenderingPreparationEngine().generateRenderPlan({
      productId: "quality-test-product",
      productionId: productionPlan.record!.imageProductionId,
      platform: ImageRenderPlatform.Print,
    });

    const engine = foundation.getImageQualityValidationEngine();
    const result = await engine.validateQuality({
      productId: "quality-test-product",
      renderPlanId: renderPlan.record!.imageRenderPlanId,
      platform: QualityValidationPlatform.Print,
      validatePrint: true,
      autoRepair: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.brandValidation.length).toBeGreaterThanOrEqual(6);
    expect(result.record?.printValidation.length).toBeGreaterThanOrEqual(8);
    expect(result.record?.platformValidation.length).toBeGreaterThanOrEqual(9);

    await core.stop("quality-test");
  });

  it("searches validations by quality score and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("quality-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "quality-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "quality-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
    });

    const productionPlan = await foundation.getImageProductionEngine().generateProductionPlan({
      productId: "quality-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
    });

    const renderPlan = await foundation.getImageRenderingPreparationEngine().generateRenderPlan({
      productId: "quality-test-product",
      productionId: productionPlan.record!.imageProductionId,
    });

    const engine = foundation.getImageQualityValidationEngine();
    await engine.validateQuality({
      productId: "quality-test-product",
      renderPlanId: renderPlan.record!.imageRenderPlanId,
      autoRepair: true,
    });

    const byProduct = engine.searchValidations({ productId: "quality-test-product" });
    const byScore = engine.searchValidations({ minQualityScore: 55 });

    expect(byProduct.length).toBeGreaterThanOrEqual(1);
    expect(byScore.length).toBeGreaterThanOrEqual(1);

    await core.stop("quality-test");
  });
});
