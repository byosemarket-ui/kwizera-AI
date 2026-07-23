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
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-render-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "render-test-product",
  productName: "Render Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for render preparation validation",
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
    productId: "render-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "render-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "render-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "render-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiImageRenderingPreparationEngine", () => {
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
    await core.start("render-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getImageRenderingPreparationEngine();
    const module = foundation.getRegistry().getModule("image-rendering-preparation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("render-test");
  });

  it("generates render plan from production plan", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("render-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "render-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "render-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      styleCategory: MultiStyleImageCategory.Technology,
      generateVariations: true,
    });

    const productionPlan = await foundation.getImageProductionEngine().generateProductionPlan({
      productId: "render-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
      productImagePlanId: productPlan.record!.productImagePlanId,
      platform: ImageProductionPlatform.Website,
      prepareExports: true,
    });

    const engine = foundation.getImageRenderingPreparationEngine();
    const result = await engine.generateRenderPlan({
      productId: "render-test-product",
      productionId: productionPlan.record!.imageProductionId,
      platform: ImageRenderPlatform.Website,
      generateRenderJobs: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.renderReadinessScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.renderValidation.every((v) => v.validated)).toBe(true);
    expect(result.record?.layerValidation.every((l) => l.validated)).toBe(true);

    await core.stop("render-test");
  });

  it("generates render plan with resource planning and output profiles", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("render-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "render-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "render-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      generateVariations: true,
    });

    const productionPlan = await foundation.getImageProductionEngine().generateProductionPlan({
      productId: "render-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
      platform: ImageProductionPlatform.Website,
    });

    const engine = foundation.getImageRenderingPreparationEngine();
    const result = await engine.generateRenderPlan({
      productId: "render-test-product",
      productionId: productionPlan.record!.imageProductionId,
      platform: ImageRenderPlatform.Print,
      prepareOutputProfiles: true,
      planResources: true,
      generateRenderJobs: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.outputProfiles.length).toBeGreaterThanOrEqual(10);
    expect(result.record?.resourcePlanning.renderQueue.length).toBeGreaterThanOrEqual(1);
    expect(result.record?.renderJobs.length).toBeGreaterThanOrEqual(1);

    await core.stop("render-test");
  });

  it("searches render plans by platform and resolution", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("render-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await foundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "render-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
    });

    const stylePlan = await foundation.getMultiStyleImageGenerationEngine().generateStylePlan({
      productId: "render-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
    });

    const productionPlan = await foundation.getImageProductionEngine().generateProductionPlan({
      productId: "render-test-product",
      stylePlanId: stylePlan.record!.stylePlanId,
    });

    const engine = foundation.getImageRenderingPreparationEngine();
    await engine.generateRenderPlan({
      productId: "render-test-product",
      productionId: productionPlan.record!.imageProductionId,
      platform: ImageRenderPlatform.Website,
    });

    const byPlatform = engine.searchRenderPlans({ platform: ImageRenderPlatform.Website });
    const byResolution = engine.searchRenderPlans({ resolution: "1920" });

    expect(byPlatform.length).toBeGreaterThanOrEqual(1);
    expect(byResolution.length).toBeGreaterThanOrEqual(1);

    await core.stop("render-test");
  });
});
