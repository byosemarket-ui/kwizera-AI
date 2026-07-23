import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  ImageTransformationBackgroundType,
  createAiCore,
  CreativePlatform,
  ImageToImagePlatform,
  ImageTransformationStyle,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageType,
  ProductUnderstandingMarketingGoal,
  SourceImageCategory,
  TextToImagePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-image-to-image-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "iti-test-product",
  productName: "Image-to-Image Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A SaaS product for image-to-image transformation validation",
  features: ["transformation", "preservation"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["saas"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: "iti-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "iti-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "iti-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "iti-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiImageToImageGenerationEngine", () => {
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
    await core.start("iti-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getImageToImageGenerationEngine();
    const module = foundation.getRegistry().getModule("image-to-image-generation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop("iti-test");
  });

  it("generates transformation plan from text-to-image source", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("iti-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const source = await imgFoundation.getTextToImageGenerationEngine().generateImagePlan({
      productId: "iti-test-product",
      platform: TextToImagePlatform.Website,
      productImageType: ProductImageType.HeroImage,
    });

    expect(source.success).toBe(true);

    const engine = imgFoundation.getImageToImageGenerationEngine();
    const result = await engine.generateTransformationPlan({
      sourceImageId: source.record!.imagePlanId,
      productId: "iti-test-product",
      platform: ImageToImagePlatform.Website,
      targetStyle: ImageTransformationStyle.Commercial,
      targetBackground: ImageTransformationBackgroundType.Studio,
      transformationPrompt: "Commercial style transfer preserving product identity",
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.maskPlan.masks.length).toBeGreaterThanOrEqual(5);
    expect(result.record?.scores.identityPreservationScore).toBeGreaterThanOrEqual(55);

    await core.stop("iti-test");
  });

  it("generates transformation plan from metadata source", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("iti-test");

    const engine = core.getManager().imageGenerationFoundation!.getImageToImageGenerationEngine();
    const result = await engine.generateTransformationPlan({
      sourceImageMetadata: {
        imageId: "iti-metadata-source",
        category: SourceImageCategory.Product,
        subject: "Test product for style transfer",
        resolution: "1920x1080",
        width: 1920,
        height: 1080,
        format: "blueprint",
        qualityScore: 85,
      },
      transformationPrompt: "Apply illustration style while preserving product shape",
      targetStyle: ImageTransformationStyle.Illustration,
      platform: ImageToImagePlatform.Instagram,
    });

    expect(result.success).toBe(true);
    expect(result.record?.profile.targetStyle).toBe(ImageTransformationStyle.Illustration);

    await core.stop("iti-test");
  });

  it("searches transformation plans by source and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("iti-test");

    const engine = core.getManager().imageGenerationFoundation!.getImageToImageGenerationEngine();
    await engine.generateTransformationPlan({
      sourceImageMetadata: {
        imageId: "iti-search-source",
        category: SourceImageCategory.Brand,
        subject: "Brand asset for search validation",
        resolution: "1080x1080",
        width: 1080,
        height: 1080,
        format: "blueprint",
        qualityScore: 90,
      },
      transformationPrompt: "Corporate brand transformation",
      platform: ImageToImagePlatform.LinkedIn,
    });

    const bySource = engine.searchTransformationPlans({ sourceImageId: "iti-search-source" });
    const byKeyword = engine.searchTransformationPlans({ keywords: "brand" });

    expect(bySource.length).toBeGreaterThanOrEqual(1);
    expect(byKeyword.length).toBeGreaterThanOrEqual(1);

    await core.stop("iti-test");
  });
});
