import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  AmbientPlatform,
  AmbientSyncTarget,
  CreativePlatform,
  EnvironmentCategory,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ambient-test-"));
}

const SAMPLE = {
  productId: "ambient-test-product",
  productName: "Ambient Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "Product for ambient audio validation",
  features: ["ambient"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["test"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(SAMPLE);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: "ambient-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "ambient-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "ambient-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "ambient-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiAmbientAudioGenerationEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("initializes and registers with audio generation foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("ambient-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getAmbientAudioGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("ambient-audio-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates ambient plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    await prepareFullPipeline(core.getManager().productIntelligenceFoundation!);

    const engine = core.getManager().audioGenerationFoundation!.getAmbientAudioGenerationEngine();
    const result = await engine.generateAmbientPlan({
      productId: "ambient-test-product",
      environmentPrompt: "Office indoor ambient with calm atmosphere",
      platform: AmbientPlatform.YouTube,
      environmentCategory: EnvironmentCategory.Indoor,
      syncTarget: AmbientSyncTarget.Video,
      videoId: "ambient-test-video",
      durationSec: 90,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.environmentalRealismScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.timelinePlan.cuePoints.length).toBeGreaterThanOrEqual(3);

    await core.stop();
  });

  it("generates ambient plan from prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAmbientAudioGenerationEngine();
    const result = await engine.generateAmbientPlan({
      environmentPrompt: "Ocean nature ambient for KWIZERA workspace background",
      brandName: "KWIZERA",
      platform: AmbientPlatform.Website,
      environmentCategory: EnvironmentCategory.Nature,
    });

    expect(result.success).toBe(true);
    expect(result.record?.ambientSoundPlan.natureAmbience.length).toBeGreaterThanOrEqual(1);
    expect(result.record?.spatialAudioPlan.surroundPreparation.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAmbientAudioGenerationEngine();
    await engine.generateAmbientPlan({
      environmentPrompt: "Forest ambient for KWIZERA validation search test",
      brandName: "KWIZERA",
      platform: AmbientPlatform.Mobile,
    });

    expect(engine.searchAmbientPlans({ keywords: "kwizera" }).length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.ambientPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
