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
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-storyboard-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "sb-test-product",
  productName: "Storyboard Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring storyboard intelligence validation",
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
    productId: "sb-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "sb-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "sb-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "sb-test-product",
    platform: CreativePlatform.Website,
  });
}

describe("AiStoryboardIntelligenceEngine", () => {
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

  it("initializes and registers with product intelligence foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("storyboard-test");

    const engine = core.getManager().productIntelligenceFoundation!.getStoryboardIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("storyboard-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates storyboard after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const result = await foundation.getStoryboardIntelligenceEngine().createStoryboard({
      productId: "sb-test-product",
    });

    expect(result.success).toBe(true);
    expect(result.record?.scenes.length).toBeGreaterThanOrEqual(5);
    expect(result.record?.scores.storyboardQualityScore).toBeGreaterThan(55);
    expect(result.record?.continuity.storyConsistency).toBe(true);
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects storyboard without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getStoryboardIntelligenceEngine()
      .createStoryboard({ productId: "missing-product" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches storyboards by scene and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getStoryboardIntelligenceEngine().createStoryboard({
      productId: "sb-test-product",
    });

    const byScene = foundation
      .getStoryboardIntelligenceEngine()
      .searchStoryboards({ scenePurpose: "hook" });
    expect(byScene.length).toBeGreaterThan(0);

    const byProduct = foundation
      .getStoryboardIntelligenceEngine()
      .searchStoryboards({ productId: "sb-test-product" });
    expect(byProduct.length).toBeGreaterThan(0);

    await core.stop();
  });
});
