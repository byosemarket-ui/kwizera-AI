import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  AudioMixingPlatform,
  AudioProductionPlatform,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-audio-production-test-"));
}

const SAMPLE = {
  productId: "audio-production-test-product",
  productName: "Audio Production Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "Product for audio production validation",
  features: ["production"],
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
    productId: "audio-production-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "audio-production-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "audio-production-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "audio-production-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiAudioProductionEngine", () => {
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
    await core.start("audio-production-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getAudioProductionEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("audio-production-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates production plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    await prepareFullPipeline(core.getManager().productIntelligenceFoundation!);

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const mix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
      productId: "audio-production-test-product",
      mixPrompt: "Production mix voice and music",
      platform: AudioMixingPlatform.YouTube,
      sessionId: "test-session",
    });

    const engine = audioFoundation.getAudioProductionEngine();
    const result = await engine.generateProductionPlan({
      productId: "audio-production-test-product",
      mixingPlanId: mix.record!.mixingPlanId,
      audioPlanId: mix.record!.mixingPlanId,
      sessionId: "test-session",
      voiceTrackRefs: ["voice-test"],
      brandId: "TestBrand",
      platform: AudioProductionPlatform.YouTube,
      prepareExports: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.productionReadinessScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.workflowValidation.every((w) => w.validated)).toBe(true);

    await core.stop();
  });

  it("generates production plan from prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioProductionEngine();
    const result = await engine.generateProductionPlan({
      productionPrompt: "Audio production for KWIZERA creative workspace",
      brandName: "KWIZERA",
      platform: AudioProductionPlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.exportPreparation.exports.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.productionStructure.trackStructure.length).toBeGreaterThanOrEqual(3);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioProductionEngine();
    await engine.generateProductionPlan({
      productionPrompt: "Production plan for KWIZERA validation search test",
      brandName: "KWIZERA",
      platform: AudioProductionPlatform.Mobile,
    });

    expect(engine.searchProductionPlans({ keywords: "kwizera" }).length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.productionPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
