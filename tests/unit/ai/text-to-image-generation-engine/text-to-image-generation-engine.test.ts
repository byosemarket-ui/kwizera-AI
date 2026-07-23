import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ImageArtisticStyle,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageType,
  ProductUnderstandingMarketingGoal,
  TextToImagePlatform,
  CreativePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-text-to-image-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "tti-test-product",
  productName: "Text-to-Image Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A comprehensive SaaS product for marketing teams requiring image plan validation",
  features: ["automation", "analytics", "collaboration"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["saas", "test"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: "tti-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "tti-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "tti-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "tti-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiTextToImageGenerationEngine", () => {
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
    await core.start("tti-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getTextToImageGenerationEngine();
    const module = foundation.getRegistry().getModule("text-to-image-generation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop("tti-test");
  });

  it("generates image plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("tti-test");

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().imageGenerationFoundation!.getTextToImageGenerationEngine();
    const result = await engine.generateImagePlan({
      productId: "tti-test-product",
      platform: TextToImagePlatform.Website,
      productImageType: ProductImageType.HeroImage,
      textPrompt: "Hero product shot with clean studio lighting",
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.promptAnalysis.subject.length).toBeGreaterThan(5);
    expect(result.record?.compositionPlan.composition.length).toBeGreaterThan(10);
    expect(result.record?.scores.promptQualityScore).toBeGreaterThanOrEqual(55);

    await core.stop("tti-test");
  });

  it("generates image plan from text prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("tti-test");

    const engine = core.getManager().imageGenerationFoundation!.getTextToImageGenerationEngine();
    const result = await engine.generateImagePlan({
      textPrompt: "Luxury minimal product photography with soft rim lighting",
      brandName: "TestBrand",
      platform: TextToImagePlatform.Instagram,
      style: ImageArtisticStyle.Luxury,
    });

    expect(result.success).toBe(true);
    expect(result.record?.stylePlan.style).toBe(ImageArtisticStyle.Luxury);

    await core.stop("tti-test");
  });

  it("searches image plans by product and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("tti-test");

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().imageGenerationFoundation!.getTextToImageGenerationEngine();
    await engine.generateImagePlan({
      productId: "tti-test-product",
      platform: TextToImagePlatform.Website,
    });

    const byProduct = engine.searchImagePlans({ productId: "tti-test-product" });
    const byKeyword = engine.searchImagePlans({ keywords: "product" });

    expect(byProduct.length).toBeGreaterThanOrEqual(1);
    expect(byKeyword.length).toBeGreaterThanOrEqual(1);

    await core.stop("tti-test");
  });
});
