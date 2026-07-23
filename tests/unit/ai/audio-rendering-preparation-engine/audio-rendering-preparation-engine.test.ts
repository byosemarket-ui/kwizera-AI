import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  AudioMixingPlatform,
  AudioProductionPlatform,
  AudioRenderPlatform,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-audio-render-test-"));
}

const SAMPLE = {
  productId: "audio-render-test-product",
  productName: "Audio Render Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "Product for audio render preparation validation",
  features: ["rendering"],
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
    productId: "audio-render-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "audio-render-test-product" });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "audio-render-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "audio-render-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiAudioRenderingPreparationEngine", () => {
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
    await core.start("audio-render-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getAudioRenderingPreparationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("audio-rendering-preparation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates render plan from production pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    await prepareFullPipeline(core.getManager().productIntelligenceFoundation!);

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const mix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
      productId: "audio-render-test-product",
      mixPrompt: "Render mix voice and music",
      platform: AudioMixingPlatform.YouTube,
      sessionId: "render-test-session",
    });

    const production = await audioFoundation.getAudioProductionEngine().generateProductionPlan({
      productId: "audio-render-test-product",
      mixingPlanId: mix.record!.mixingPlanId,
      audioPlanId: mix.record!.mixingPlanId,
      sessionId: "render-test-session",
      voiceTrackRefs: ["voice-test"],
      brandId: "TestBrand",
      platform: AudioProductionPlatform.YouTube,
      prepareExports: true,
    });

    const engine = audioFoundation.getAudioRenderingPreparationEngine();
    const result = await engine.generateRenderPlan({
      productId: "audio-render-test-product",
      productionId: production.record!.audioProductionId,
      audioPlanId: production.record!.profile.audioPlanId,
      sessionId: "render-test-session",
      brandId: "TestBrand",
      platform: AudioRenderPlatform.YouTube,
      prepareOutputProfiles: true,
      generateRenderJobs: true,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.renderReady).toBe(true);
    expect(result.record?.scores.renderReadinessScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.renderValidation.every((v) => v.validated)).toBe(true);

    await core.stop();
  });

  it("generates render plan from prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioRenderingPreparationEngine();
    const result = await engine.generateRenderPlan({
      renderPrompt: "Audio render preparation for KWIZERA creative workspace",
      brandName: "KWIZERA",
      platform: AudioRenderPlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.outputProfiles.length).toBeGreaterThanOrEqual(4);
    expect(result.record?.trackStructure.length).toBeGreaterThanOrEqual(3);
    expect(result.record?.timelineStructure.length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getAudioRenderingPreparationEngine();
    await engine.generateRenderPlan({
      renderPrompt: "Render plan for KWIZERA validation search test",
      brandName: "KWIZERA",
      platform: AudioRenderPlatform.Mobile,
    });

    expect(engine.searchRenderPlans({ keywords: "kwizera" }).length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.renderPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
