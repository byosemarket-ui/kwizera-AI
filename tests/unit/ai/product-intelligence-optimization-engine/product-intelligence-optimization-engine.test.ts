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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-pi-optimization-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "pio-test-product",
  productName: "PI Optimization Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring product intelligence optimization validation",
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
    productId: "pio-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "pio-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "pio-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "pio-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "pio-test-product",
  });
  await foundation.getScriptPlanningEngine().createScriptPlan({
    productId: "pio-test-product",
  });
  await foundation.getVisualPlanningEngine().createVisualPlan({
    productId: "pio-test-product",
  });
  await foundation.getAudioPlanningEngine().createAudioPlan({
    productId: "pio-test-product",
  });
  await foundation.getProductionPlanningEngine().createProductionPlan({
    productId: "pio-test-product",
  });
  await foundation.getQualityPredictionEngine().predictQuality({
    productId: "pio-test-product",
  });
}

describe("AiProductIntelligenceOptimizationEngine", () => {
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
    await core.start("pi-optimization-test");

    const engine = core.getManager().productIntelligenceFoundation!.getProductIntelligenceOptimizationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("product-intelligence-optimization");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("runs optimization after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const result = await foundation.getProductIntelligenceOptimizationEngine().runOptimization({
      productId: "pio-test-product",
    });

    expect(result.success).toBe(true);
    expect(result.record?.moduleResults.length).toBe(11);
    expect(result.record?.moduleResults.every((m) => m.qualityScoreAfter >= m.qualityScoreBefore)).toBe(true);
    expect(result.record?.scores.overallImprovementScore).toBeGreaterThanOrEqual(5);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.recoveryPointId).toBeTruthy();
    expect(result.recovered).not.toBe(true);

    await core.stop();
  });

  it("rejects optimization without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getProductIntelligenceOptimizationEngine()
      .runOptimization({ productId: "missing-product" });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches optimizations by brand and improvement score", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getProductIntelligenceOptimizationEngine().runOptimization({ productId: "pio-test-product" });

    const engine = foundation.getProductIntelligenceOptimizationEngine();
    const byBrand = engine.searchOptimizations({ brand: "TestBrand" });
    const byScore = engine.searchOptimizations({ minImprovementScore: 5 });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byScore.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
