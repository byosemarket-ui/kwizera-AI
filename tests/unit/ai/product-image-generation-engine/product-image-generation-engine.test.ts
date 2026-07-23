import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  ALL_PRODUCT_PRESENTATION_VIEWS,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageBackgroundType,
  ProductImageGenPlatform,
  ProductPhotographyMode,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-product-image-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "pig-test-product",
  productName: "Product Image Generation Test Product",
  category: ProductAnalysisCategory.Beauty,
  subcategory: "skincare",
  brand: "TestBrand",
  description: "A beauty product for product image generation validation",
  features: ["hydrating", "anti-aging"],
  specifications: { volume: "50ml" },
  materials: ["glass"],
  price: 39.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.D2C,
  tags: ["test"],
  keywords: ["beauty"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: "pig-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "pig-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "pig-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "pig-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiProductImageGenerationEngine", () => {
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
    await core.start("pig-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getProductImageGenerationEngine();
    const module = foundation.getRegistry().getModule("product-image-generation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop("pig-test");
  });

  it("generates product image plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("pig-test");

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().imageGenerationFoundation!.getProductImageGenerationEngine();
    const result = await engine.generateProductImagePlan({
      productId: "pig-test-product",
      platform: ProductImageGenPlatform.Ecommerce,
      backgroundType: ProductImageBackgroundType.WhiteBackground,
      photographyMode: ProductPhotographyMode.LuxuryPhotography,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.presentationPlan.views.length).toBe(ALL_PRODUCT_PRESENTATION_VIEWS.length);
    expect(result.record?.scores.productPresentationScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.marketplaceReady).toBe(true);

    await core.stop("pig-test");
  });

  it("generates plan with marketing variations and platform optimizations", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("pig-test");

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().imageGenerationFoundation!.getProductImageGenerationEngine();
    const result = await engine.generateProductImagePlan({
      productId: "pig-test-product",
      generateMarketingVariations: true,
      generatePlatformOptimizations: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.marketingVariations.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.platformOptimizations.length).toBeGreaterThanOrEqual(1);

    await core.stop("pig-test");
  });

  it("searches product image plans by product and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("pig-test");

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().imageGenerationFoundation!.getProductImageGenerationEngine();
    await engine.generateProductImagePlan({ productId: "pig-test-product" });

    const byProduct = engine.searchProductImagePlans({ productId: "pig-test-product" });
    const byKeyword = engine.searchProductImagePlans({ keywords: "product" });

    expect(byProduct.length).toBeGreaterThanOrEqual(1);
    expect(byKeyword.length).toBeGreaterThanOrEqual(1);

    await core.stop("pig-test");
  });
});
