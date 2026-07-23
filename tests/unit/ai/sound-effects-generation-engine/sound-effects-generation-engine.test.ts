import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  SfxPlatform,
  SfxSyncTarget,
  SoundCategory,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-sfx-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "sfx-test-product",
  productName: "SFX Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A comprehensive SaaS product for marketing teams requiring sound effects validation",
  features: ["automation", "SFX", "audio"],
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
    productId: "sfx-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "sfx-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "sfx-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "sfx-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiSoundEffectsGenerationEngine", () => {
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

  it("initializes and registers with audio generation foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("sfx-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getSoundEffectsGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("sound-effects-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates sound effect plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().audioGenerationFoundation!.getSoundEffectsGenerationEngine();
    const result = await engine.generateSoundEffectPlan({
      productId: "sfx-test-product",
      soundPrompt: "Cinematic impact and whoosh for product launch video",
      platform: SfxPlatform.YouTube,
      soundCategory: SoundCategory.Cinematic,
      syncTarget: SfxSyncTarget.Video,
      videoId: "sfx-test-video",
      durationSec: 45,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.realismScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.timelinePlan.cuePoints.length).toBeGreaterThanOrEqual(3);

    await core.stop();
  });

  it("generates sound effect plan from prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getSoundEffectsGenerationEngine();
    const result = await engine.generateSoundEffectPlan({
      soundPrompt: "Transition whoosh for KWIZERA brand announcement",
      brandName: "KWIZERA",
      platform: SfxPlatform.Website,
      soundCategory: SoundCategory.Transition,
    });

    expect(result.success).toBe(true);
    expect(result.record?.foleyPlan.foleyTypes.length).toBeGreaterThanOrEqual(1);
    expect(result.record?.environmentalPlan.ambientLayers.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getSoundEffectsGenerationEngine();
    await engine.generateSoundEffectPlan({
      soundPrompt: "Search test SFX for KWIZERA sound effects engine validation",
      brandName: "KWIZERA",
      platform: SfxPlatform.Mobile,
      soundCategory: SoundCategory.Interface,
    });

    const results = engine.searchSoundEffectPlans({ keywords: "kwizera" });
    expect(results.length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.soundPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
