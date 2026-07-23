import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  AudioMixingPlatform,
  AudioTrackType,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-mixmaster-test-"));
}

const SAMPLE = {
  productId: "mixmaster-test-product",
  productName: "MixMaster Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "Product for mix/master validation",
  features: ["mixing"],
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
    productId: "mixmaster-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "mixmaster-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "mixmaster-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "mixmaster-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiAudioMixingMasteringEngine", () => {
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
    await core.start("mixmaster-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getAudioMixingMasteringEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("audio-mixing-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates mix/master plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    await prepareFullPipeline(core.getManager().productIntelligenceFoundation!);

    const engine = core.getManager().audioGenerationFoundation!.getAudioMixingMasteringEngine();
    const result = await engine.generateMixMasterPlan({
      productId: "mixmaster-test-product",
      mixPrompt: "Multi-track mix with voice music and ambient for video",
      platform: AudioMixingPlatform.YouTube,
      sessionId: "mixmaster-test-session",
      videoId: "mixmaster-test-video",
      voiceTrackRefs: ["voice-1"],
      musicTrackRefs: ["music-1"],
      trackTypes: [AudioTrackType.Voice, AudioTrackType.Music, AudioTrackType.MasterBus],
      durationSec: 90,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.mixingQualityScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.masteringPlan.techniques.length).toBeGreaterThanOrEqual(6);

    await core.stop();
  });

  it("generates mix/master plan from prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioMixingMasteringEngine();
    const result = await engine.generateMixMasterPlan({
      mixPrompt: "Voice and music mix for KWIZERA creative workspace",
      brandName: "KWIZERA",
      platform: AudioMixingPlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.mixingPlan.busRouting.length).toBeGreaterThanOrEqual(3);
    expect(result.record?.spatialMixPlan.monoCompatibility.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioMixingMasteringEngine();
    await engine.generateMixMasterPlan({
      mixPrompt: "Mix and master for KWIZERA validation search test",
      brandName: "KWIZERA",
      platform: AudioMixingPlatform.Mobile,
    });

    expect(engine.searchMixMasterPlans({ keywords: "kwizera" }).length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.mixMasterPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
