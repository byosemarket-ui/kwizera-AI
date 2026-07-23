import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BrandDesignGenPlatform,
  BrandDesignType,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-branding-design-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "brand-test-product",
  productName: "Brand Test Product",
  category: ProductAnalysisCategory.Electronics,
  subcategory: "gadgets",
  brand: "TestBrand",
  description: "Electronics product for branding design validation",
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
    productId: "brand-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "brand-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "brand-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "brand-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiBrandingDesignEngine", () => {
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
    await core.start("brand-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    const engine = foundation.getBrandingDesignEngine();
    const module = foundation.getRegistry().getModule("branding-design-generation-engine");

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(module?.implemented).toBe(true);

    await core.stop("brand-test");
  });

  it("generates branding plan from product image plan", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("brand-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "brand-test-product",
    });

    const engine = imgFoundation.getBrandingDesignEngine();
    const result = await engine.generateBrandingPlan({
      productId: "brand-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      brandId: "TestBrand",
      designType: BrandDesignType.PosterLayout,
      platform: BrandDesignGenPlatform.Website,
      colorPalette: ["#0066CC", "#FFFFFF"],
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.logoPlanning.variants.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.scores.brandingScore).toBeGreaterThanOrEqual(55);

    await core.stop("brand-test");
  });

  it("generates branding plan with logo, social, and print design", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("brand-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "brand-test-product",
    });

    const engine = imgFoundation.getBrandingDesignEngine();
    const result = await engine.generateBrandingPlan({
      productId: "brand-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      generateLogoPlan: true,
      generateSocialMediaDesign: true,
      generatePrintDesign: true,
      generatePlatformOptimizations: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.socialMediaDesign.formats.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.printDesign.formats.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.platformOptimizations.length).toBeGreaterThanOrEqual(4);

    await core.stop("brand-test");
  });

  it("searches branding plans by brand and keywords", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("brand-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const productPlan = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
      productId: "brand-test-product",
    });

    const engine = imgFoundation.getBrandingDesignEngine();
    await engine.generateBrandingPlan({
      productId: "brand-test-product",
      productImagePlanId: productPlan.record!.productImagePlanId,
      brandId: "TestBrand",
      designPrompt: "Professional branding and graphic design workflow",
    });

    const byBrand = engine.searchBrandingPlans({ brandId: "TestBrand" });
    const byKeyword = engine.searchBrandingPlans({ keywords: "branding" });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byKeyword.length).toBeGreaterThanOrEqual(1);

    await core.stop("brand-test");
  });
});
