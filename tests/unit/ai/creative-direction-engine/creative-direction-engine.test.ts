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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-creative-direction-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "cd-test-product",
  productName: "Creative Direction Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring creative direction validation",
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
    productId: "cd-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "cd-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "cd-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
}

describe("AiCreativeDirectionEngine", () => {
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
    await core.start("creative-direction-test");

    const engine = core.getManager().productIntelligenceFoundation!.getCreativeDirectionEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("creative-direction");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("plans creative direction after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const result = await foundation.getCreativeDirectionEngine().planCreativeDirection({
      productId: "cd-test-product",
      platform: CreativePlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.creativeQualityScore).toBeGreaterThan(55);
    expect(result.record?.visualDirection.colorPalette.length).toBeGreaterThan(2);
    expect(result.record?.platformDirections.length).toBeGreaterThan(1);
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects creative direction without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getCreativeDirectionEngine()
      .planCreativeDirection({ productId: "missing-product" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches creative directions by style and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getCreativeDirectionEngine().planCreativeDirection({
      productId: "cd-test-product",
      platform: CreativePlatform.YouTube,
    });

    const byProduct = foundation
      .getCreativeDirectionEngine()
      .searchCreativeDirections({ productId: "cd-test-product" });
    expect(byProduct.length).toBeGreaterThan(0);

    const byPlatform = foundation
      .getCreativeDirectionEngine()
      .searchCreativeDirections({ platform: CreativePlatform.YouTube });
    expect(byPlatform.length).toBeGreaterThan(0);

    await core.stop();
  });
});
