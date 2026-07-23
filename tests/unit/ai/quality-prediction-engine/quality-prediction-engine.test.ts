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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-quality-prediction-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "qp-test-product",
  productName: "Quality Prediction Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring quality prediction intelligence validation",
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
    productId: "qp-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "qp-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "qp-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "qp-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "qp-test-product",
  });
  await foundation.getScriptPlanningEngine().createScriptPlan({
    productId: "qp-test-product",
  });
  await foundation.getVisualPlanningEngine().createVisualPlan({
    productId: "qp-test-product",
  });
  await foundation.getAudioPlanningEngine().createAudioPlan({
    productId: "qp-test-product",
  });
  await foundation.getProductionPlanningEngine().createProductionPlan({
    productId: "qp-test-product",
  });
}

describe("AiQualityPredictionEngine", () => {
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
    await core.start("quality-prediction-test");

    const engine = core.getManager().productIntelligenceFoundation!.getQualityPredictionEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("quality-prediction");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("predicts quality after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const productionPlan = foundation
      .getProductionPlanningEngine()
      .getProductionPlansByProduct("qp-test-product")[0];

    const result = await foundation.getQualityPredictionEngine().predictQuality({
      productId: "qp-test-product",
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.overallQualityScore).toBeGreaterThan(55);
    expect(result.record?.scores.productionReadinessScore).toBeGreaterThan(55);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.checks.issues.length).toBe(0);
    expect(result.record?.risks.some((r) => r.severity === "critical" && !r.resolved)).toBe(false);
    expect(result.record?.productionPlanId).toBe(productionPlan?.productionPlanId);
    expect(result.record?.recommendations.platformOptimization.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("rejects quality prediction without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getQualityPredictionEngine()
      .predictQuality({ productId: "missing-product" });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches quality predictions by brand and quality score", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getQualityPredictionEngine().predictQuality({ productId: "qp-test-product" });

    const engine = foundation.getQualityPredictionEngine();
    const byBrand = engine.searchQualityPredictions({ brand: "TestBrand" });
    const byScore = engine.searchQualityPredictions({ minQualityScore: 55 });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byScore.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
