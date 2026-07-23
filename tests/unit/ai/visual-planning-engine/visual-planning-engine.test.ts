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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-visual-planning-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "vp-test-product",
  productName: "Visual Planning Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring visual planning intelligence validation",
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
    productId: "vp-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "vp-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "vp-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "vp-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "vp-test-product",
  });
  await foundation.getScriptPlanningEngine().createScriptPlan({
    productId: "vp-test-product",
  });
}

describe("AiVisualPlanningEngine", () => {
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
    await core.start("visual-planning-test");

    const engine = core.getManager().productIntelligenceFoundation!.getVisualPlanningEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("visual-planning");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates visual plan after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const storyboard = foundation
      .getStoryboardIntelligenceEngine()
      .getStoryboardsByProduct("vp-test-product")[0];
    const scriptPlan = foundation
      .getScriptPlanningEngine()
      .getScriptPlansByProduct("vp-test-product")[0];

    const result = await foundation.getVisualPlanningEngine().createVisualPlan({
      productId: "vp-test-product",
    });

    expect(result.success).toBe(true);
    expect(result.record?.scenePlans.length).toBeGreaterThanOrEqual(5);
    expect(result.record?.scenePlans.length).toBe(storyboard?.scenes.length);
    expect(result.record?.scenePlans.length).toBe(scriptPlan?.scenePlans.length);
    expect(result.record?.scores.visualPlanningScore).toBeGreaterThan(55);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scenePlans.every((s) => s.composition.startsWith("Plan composition"))).toBe(true);

    await core.stop();
  });

  it("rejects visual plan without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getVisualPlanningEngine()
      .createVisualPlan({ productId: "missing-product" });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches visual plans by brand and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getVisualPlanningEngine().createVisualPlan({ productId: "vp-test-product" });

    const engine = foundation.getVisualPlanningEngine();
    const byBrand = engine.searchVisualPlans({ brand: "TestBrand" });
    const byPlatform = engine.searchVisualPlans({ platform: CreativePlatform.Website });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byPlatform.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
