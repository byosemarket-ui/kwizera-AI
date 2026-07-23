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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-script-planning-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "sp-test-product",
  productName: "Script Planning Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring script planning intelligence validation",
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
    productId: "sp-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "sp-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "sp-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "sp-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "sp-test-product",
  });
}

describe("AiScriptPlanningEngine", () => {
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
    await core.start("script-planning-test");

    const engine = core.getManager().productIntelligenceFoundation!.getScriptPlanningEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("script-planning");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates script plan after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const storyboard = foundation
      .getStoryboardIntelligenceEngine()
      .getStoryboardsByProduct("sp-test-product")[0];

    const result = await foundation.getScriptPlanningEngine().createScriptPlan({
      productId: "sp-test-product",
    });

    expect(result.success).toBe(true);
    expect(result.record?.scenePlans.length).toBeGreaterThanOrEqual(5);
    expect(result.record?.scenePlans.length).toBe(storyboard?.scenes.length);
    expect(result.record?.scores.scriptPlanningScore).toBeGreaterThan(55);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scenePlans.every((s) => s.plannedNarration.startsWith("Plan narration"))).toBe(true);

    await core.stop();
  });

  it("rejects script plan without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getScriptPlanningEngine()
      .createScriptPlan({ productId: "missing-product" });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches script plans by brand and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getScriptPlanningEngine().createScriptPlan({ productId: "sp-test-product" });

    const engine = foundation.getScriptPlanningEngine();
    const byBrand = engine.searchScriptPlans({ brand: "TestBrand" });
    const byPlatform = engine.searchScriptPlans({ platform: CreativePlatform.Website });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byPlatform.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
