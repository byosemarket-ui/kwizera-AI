import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BackgroundGenType,
  createAiCore,
  CreativePlatform,
  ImageEditOperationType,
  ImageEnhanceCategory,
  ImageEnhanceGenPlatform,
  ImageEnhanceOperationType,
  ImageEnhanceRestorationType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-image-enhancement-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "enhance-test-product",
  productName: "Enhancement Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for image enhancement validation",
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
    productId: "enhance-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "enhance-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "enhance-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "enhance-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiImageEnhancementEngine", () => {
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
    await core.start("enhance-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getImageEnhancementEngine();
    const module = foundation.getRegistry().getModule("image-enhancement-generation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("enhance-test");
  });

  it("generates enhancement plan from editing pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("enhance-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "enhance-test-product",
    });
    const bgPlan = await imgFoundation.getBackgroundGenerationEngine().generateBackgroundPlan({
      productId: "enhance-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      targetBackground: BackgroundGenType.WhiteBackground,
    });
    const editPlan = await imgFoundation.getImageEditingEngine().generateEditingPlan({
      productId: "enhance-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      backgroundPlanId: bgPlan.record!.backgroundPlanId,
      sourceImageId: productPlan.record!.productImagePlanId,
      primaryOperation: ImageEditOperationType.ProductCleanup,
    });

    const engine = imgFoundation.getImageEnhancementEngine();
    const result = await engine.generateEnhancementPlan({
      productId: "enhance-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      imageEditingPlanId: editPlan.record!.imageEditingPlanId,
      editedImageId: editPlan.record!.profile.editedImageId,
      sourceImageId: productPlan.record!.productImagePlanId,
      primaryEnhancement: ImageEnhanceOperationType.SuperResolutionPlanning,
      restorationType: ImageEnhanceRestorationType.DustRemoval,
      platform: ImageEnhanceGenPlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.preservation.targets.length).toBeGreaterThanOrEqual(6);
    expect(result.record?.scores.enhancementScore).toBeGreaterThanOrEqual(55);

    await core.stop("enhance-test");
  });

  it("generates enhancement plan with print preparation and super resolution", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("enhance-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "enhance-test-product",
    });

    const engine = imgFoundation.getImageEnhancementEngine();
    const result = await engine.generateEnhancementPlan({
      productId: "enhance-test-product",
      sourceImageId: productPlan.record!.productImagePlanId,
      imageCategory: ImageEnhanceCategory.Product,
      generatePrintPreparation: true,
      generatePlatformOptimizations: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.superResolutionPlan.targetResolution).toBeDefined();
    expect(result.record?.printPreparation.dpiPlanning).toBeDefined();
    expect(result.record?.platformOptimizations.length).toBeGreaterThanOrEqual(4);

    await core.stop("enhance-test");
  });

  it("searches enhancement plans by product and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("enhance-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "enhance-test-product",
    });

    const engine = imgFoundation.getImageEnhancementEngine();
    await engine.generateEnhancementPlan({
      productId: "enhance-test-product",
      sourceImageId: productPlan.record!.productImagePlanId,
      restorationPrompt: "Professional image enhancement workflow",
    });

    const byProduct = engine.searchEnhancementPlans({ productId: "enhance-test-product" });
    const byKeyword = engine.searchEnhancementPlans({ keywords: "enhancement" });

    expect(byProduct.length).toBeGreaterThanOrEqual(1);
    expect(byKeyword.length).toBeGreaterThanOrEqual(1);

    await core.stop("enhance-test");
  });
});
