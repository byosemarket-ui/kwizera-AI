import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  AudioInputCategory,
  AudioEnhancementPlatform,
  AudioEnhancementType,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-enhancement-test-"));
}

const SAMPLE = {
  productId: "enhancement-test-product",
  productName: "Enhancement Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "Product for audio enhancement validation",
  features: ["enhancement"],
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
    productId: "enhancement-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "enhancement-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "enhancement-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "enhancement-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiAudioEnhancementRestorationEngine", () => {
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
    await core.start("enhancement-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getAudioEnhancementRestorationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("audio-enhancement-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates enhancement plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    await prepareFullPipeline(core.getManager().productIntelligenceFoundation!);

    const engine = core.getManager().audioGenerationFoundation!.getAudioEnhancementRestorationEngine();
    const result = await engine.generateEnhancementPlan({
      productId: "enhancement-test-product",
      audioPrompt: "Voice narration with background noise and echo for video",
      platform: AudioEnhancementPlatform.YouTube,
      enhancementType: AudioEnhancementType.Voice,
      audioCategory: AudioInputCategory.VoiceAudio,
      videoId: "enhancement-test-video",
      durationSec: 90,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.audioClarityScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.enhancementPlan.techniques.length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("generates enhancement plan from prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioEnhancementRestorationEngine();
    const result = await engine.generateEnhancementPlan({
      audioPrompt: "Old vintage voice recording with hum and hiss for KWIZERA restoration",
      brandName: "KWIZERA",
      platform: AudioEnhancementPlatform.Audiobook,
      enhancementType: AudioEnhancementType.Voice,
    });

    expect(result.success).toBe(true);
    expect(result.record?.restorationPlan.techniques.length).toBeGreaterThanOrEqual(1);
    expect(result.record?.enhancementPlan.processingChain.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioEnhancementRestorationEngine();
    await engine.generateEnhancementPlan({
      audioPrompt: "Voice enhancement for KWIZERA validation search test",
      brandName: "KWIZERA",
      platform: AudioEnhancementPlatform.Mobile,
    });

    expect(engine.searchEnhancementPlans({ keywords: "kwizera" }).length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.enhancementPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
