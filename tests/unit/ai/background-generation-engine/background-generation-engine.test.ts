import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BackgroundGenPlatform,
  BackgroundGenType,
  BackgroundMarketingPreset,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-background-gen-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "bg-test-product",
  productName: "Background Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for background generation validation",
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
    productId: "bg-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "bg-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "bg-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "bg-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiBackgroundGenerationEngine", () => {
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
    await core.start("bg-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getBackgroundGenerationEngine();
    const module = foundation.getRegistry().getModule("background-generation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("bg-test");
  });

  it("generates background plan from product image plan", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bg-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "bg-test-product",
    });
    expect(productPlan.success).toBe(true);

    const engine = imgFoundation.getBackgroundGenerationEngine();
    const result = await engine.generateBackgroundPlan({
      productId: "bg-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      targetBackground: BackgroundGenType.WhiteBackground,
      marketingPreset: BackgroundMarketingPreset.Electronics,
      platform: BackgroundGenPlatform.AmazonStyle,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.subjectPreservation.targets.length).toBeGreaterThanOrEqual(6);
    expect(result.record?.scores.subjectPreservationScore).toBeGreaterThanOrEqual(55);

    await core.stop("bg-test");
  });

  it("generates background plan with replacement variations", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bg-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "bg-test-product",
    });

    const engine = imgFoundation.getBackgroundGenerationEngine();
    const result = await engine.generateBackgroundPlan({
      productId: "bg-test-product",
      sourceImageId: productPlan.record!.productImagePlanId,
      generateReplacements: true,
      generatePlatformOptimizations: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.replacementPlan.variations.length).toBeGreaterThanOrEqual(4);

    await core.stop("bg-test");
  });

  it("searches background plans by product and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("bg-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "bg-test-product",
    });

    const engine = imgFoundation.getBackgroundGenerationEngine();
    await engine.generateBackgroundPlan({
      productId: "bg-test-product",
      sourceImageId: productPlan.record!.productImagePlanId,
    });

    const byProduct = engine.searchBackgroundPlans({ productId: "bg-test-product" });
    const byKeyword = engine.searchBackgroundPlans({ keywords: "background" });

    expect(byProduct.length).toBeGreaterThanOrEqual(1);
    expect(byKeyword.length).toBeGreaterThanOrEqual(1);

    await core.stop("bg-test");
  });
});
