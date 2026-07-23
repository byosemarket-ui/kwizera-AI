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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-production-planning-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "pp-test-product",
  productName: "Production Planning Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring production planning intelligence validation",
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
    productId: "pp-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "pp-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "pp-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "pp-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "pp-test-product",
  });
  await foundation.getScriptPlanningEngine().createScriptPlan({
    productId: "pp-test-product",
  });
  await foundation.getVisualPlanningEngine().createVisualPlan({
    productId: "pp-test-product",
  });
  await foundation.getAudioPlanningEngine().createAudioPlan({
    productId: "pp-test-product",
  });
}

describe("AiProductionPlanningEngine", () => {
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
    await core.start("production-planning-test");

    const engine = core.getManager().productIntelligenceFoundation!.getProductionPlanningEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("production-planning");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates production plan after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const storyboard = foundation
      .getStoryboardIntelligenceEngine()
      .getStoryboardsByProduct("pp-test-product")[0];
    const audioPlan = foundation
      .getAudioPlanningEngine()
      .getAudioPlansByProduct("pp-test-product")[0];

    const result = await foundation.getProductionPlanningEngine().createProductionPlan({
      productId: "pp-test-product",
    });

    expect(result.success).toBe(true);
    expect(result.record?.sceneProductionPlans.length).toBeGreaterThanOrEqual(5);
    expect(result.record?.sceneProductionPlans.length).toBe(storyboard?.scenes.length);
    expect(result.record?.scores.productionReadinessScore).toBeGreaterThan(55);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.dependencies.issues.length).toBe(0);
    expect(result.record?.audioPlanId).toBe(audioPlan?.audioPlanId);
    expect(result.record?.sceneProductionPlans.every((s) => s.renderInstructions.startsWith("Plan render"))).toBe(true);

    await core.stop();
  });

  it("rejects production plan without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getProductionPlanningEngine()
      .createProductionPlan({ productId: "missing-product" });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches production plans by brand and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getProductionPlanningEngine().createProductionPlan({ productId: "pp-test-product" });

    const engine = foundation.getProductionPlanningEngine();
    const byBrand = engine.searchProductionPlans({ brand: "TestBrand" });
    const byPlatform = engine.searchProductionPlans({ platform: CreativePlatform.Website });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byPlatform.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
