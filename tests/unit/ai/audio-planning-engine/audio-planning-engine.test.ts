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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-audio-planning-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "ap-test-product",
  productName: "Audio Planning Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for marketing teams requiring audio planning intelligence validation",
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
    productId: "ap-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "ap-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "ap-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "ap-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "ap-test-product",
  });
  await foundation.getScriptPlanningEngine().createScriptPlan({
    productId: "ap-test-product",
  });
  await foundation.getVisualPlanningEngine().createVisualPlan({
    productId: "ap-test-product",
  });
}

describe("AiAudioPlanningEngine", () => {
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
    await core.start("audio-planning-test");

    const engine = core.getManager().productIntelligenceFoundation!.getAudioPlanningEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("audio-planning");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates audio plan after full intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const storyboard = foundation
      .getStoryboardIntelligenceEngine()
      .getStoryboardsByProduct("ap-test-product")[0];
    const scriptPlan = foundation
      .getScriptPlanningEngine()
      .getScriptPlansByProduct("ap-test-product")[0];
    const visualPlan = foundation
      .getVisualPlanningEngine()
      .getVisualPlansByProduct("ap-test-product")[0];

    const result = await foundation.getAudioPlanningEngine().createAudioPlan({
      productId: "ap-test-product",
    });

    expect(result.success).toBe(true);
    expect(result.record?.sceneAudioPlans.length).toBeGreaterThanOrEqual(5);
    expect(result.record?.sceneAudioPlans.length).toBe(storyboard?.scenes.length);
    expect(result.record?.sceneAudioPlans.length).toBe(scriptPlan?.scenePlans.length);
    expect(result.record?.sceneAudioPlans.length).toBe(visualPlan?.scenePlans.length);
    expect(result.record?.scores.audioPlanningScore).toBeGreaterThan(55);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.sceneAudioPlans.every((s) => s.plannedVoiceOver.startsWith("Plan voice-over"))).toBe(true);

    await core.stop();
  });

  it("rejects audio plan without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .productIntelligenceFoundation!.getAudioPlanningEngine()
      .createAudioPlan({ productId: "missing-product" });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches audio plans by brand and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getAudioPlanningEngine().createAudioPlan({ productId: "ap-test-product" });

    const engine = foundation.getAudioPlanningEngine();
    const byBrand = engine.searchAudioPlans({ brand: "TestBrand" });
    const byPlatform = engine.searchAudioPlans({ platform: CreativePlatform.Website });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byPlatform.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
