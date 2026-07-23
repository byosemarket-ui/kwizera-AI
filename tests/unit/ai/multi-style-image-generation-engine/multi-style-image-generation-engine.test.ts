import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  MultiStyleGenPlatform,
  MultiStyleImageCategory,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-multi-style-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "style-test-product",
  productName: "Style Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for multi-style generation validation",
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
    productId: "style-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "style-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "style-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "style-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiMultiStyleImageGenerationEngine", () => {
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
    await core.start("style-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getMultiStyleImageGenerationEngine();
    const module = foundation.getRegistry().getModule("multi-style-image-generation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("style-test");
  });

  it("generates style plan from product image plan", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("style-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "style-test-product",
    });

    const engine = imgFoundation.getMultiStyleImageGenerationEngine();
    const result = await engine.generateStylePlan({
      productId: "style-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      styleCategory: MultiStyleImageCategory.Commercial,
      platform: MultiStyleGenPlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.identityPreservation.targets.length).toBeGreaterThanOrEqual(7);
    expect(result.record?.scores.styleQualityScore).toBeGreaterThanOrEqual(55);

    await core.stop("style-test");
  });

  it("generates style plan with variations and platform optimizations", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("style-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "style-test-product",
    });

    const engine = imgFoundation.getMultiStyleImageGenerationEngine();
    const result = await engine.generateStylePlan({
      productId: "style-test-product",
      sourceImageId: productPlan.record!.productImagePlanId,
      generateVariations: true,
      generatePlatformOptimizations: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.styleVariations.variations.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.platformOptimizations.length).toBeGreaterThanOrEqual(4);

    await core.stop("style-test");
  });

  it("searches style plans by style category and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("style-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "style-test-product",
    });

    const engine = imgFoundation.getMultiStyleImageGenerationEngine();
    await engine.generateStylePlan({
      productId: "style-test-product",
      sourceImageId: productPlan.record!.productImagePlanId,
      prompt: "Multi-style image generation workflow",
    });

    const byStyle = engine.searchStylePlans({ styleCategory: MultiStyleImageCategory.Commercial });
    const byKeyword = engine.searchStylePlans({ keywords: "multi-style" });

    expect(byStyle.length + byKeyword.length).toBeGreaterThanOrEqual(1);

    await core.stop("style-test");
  });
});
