import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CreativePlatform,
  createAiCore,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  StoryboardGenerationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-story-gen-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "sg-test-product",
  productName: "Story Generation Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring storyboard generation validation",
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
    productId: "sg-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "sg-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "sg-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "sg-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "sg-test-product",
  });
}

describe("AiStoryboardGenerationEngine", () => {
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

  it("initializes and registers with video generation foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("story-gen-test");

    const engine = core.getManager().videoGenerationFoundation!.getStoryGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("story-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");
  });

  it("generates storyboard with scenes, shots, and platform variations", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("story-gen-test");

    await prepareFullPipeline(core.getManager().productIntelligenceFoundation!);

    const engine = core.getManager().videoGenerationFoundation!.getStoryGenerationEngine();
    const result = await engine.generateStoryboard({
      productId: "sg-test-product",
      platform: StoryboardGenerationPlatform.Website,
      generatePlatformVariations: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scenes.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.profile.totalShots).toBeGreaterThanOrEqual(result.record!.scenes.length);
    expect(result.record?.platformVariations.length).toBeGreaterThanOrEqual(8);
    expect(result.record?.scores.storyQualityScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.storyStructure.openingHook.length).toBeGreaterThan(0);
    expect(result.record?.storyStructure.callToAction.length).toBeGreaterThan(0);
  });

  it("rejects generation without upstream context or prompt", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("story-gen-test");

    const engine = core.getManager().videoGenerationFoundation!.getStoryGenerationEngine();
    const result = await engine.generateStoryboard({ productId: "nonexistent-product" });

    expect(result.success).toBe(false);
  });

  it("supports search by product and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("story-gen-test");

    await prepareFullPipeline(core.getManager().productIntelligenceFoundation!);

    const engine = core.getManager().videoGenerationFoundation!.getStoryGenerationEngine();
    await engine.generateStoryboard({
      productId: "sg-test-product",
      platform: StoryboardGenerationPlatform.Website,
    });

    const byProduct = engine.searchStoryboards({ productId: "sg-test-product" });
    expect(byProduct.length).toBeGreaterThanOrEqual(1);

    const byPlatform = engine.searchStoryboards({ platform: StoryboardGenerationPlatform.Website });
    expect(byPlatform.length).toBeGreaterThanOrEqual(1);
  });
});
