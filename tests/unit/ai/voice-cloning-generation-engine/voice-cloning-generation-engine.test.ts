import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  EmotionType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  VcLanguage,
  VcPlatform,
  VoiceLibraryType,
  VoiceType,
  CreativePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-voice-cloning-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "vc-test-product",
  productName: "VC Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A comprehensive SaaS product for marketing teams requiring voice cloning validation",
  features: ["automation", "voice cloning", "narration"],
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
    productId: "vc-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "vc-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "vc-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "vc-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiVoiceCloningGenerationEngine", () => {
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
    await core.start("vc-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getVoiceCloningGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("voice-cloning-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates cloning plan from product pipeline with authorization", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().audioGenerationFoundation!.getVoiceCloningGenerationEngine();
    const result = await engine.generateCloningPlan({
      productId: "vc-test-product",
      voiceSampleId: "vc-test-voice-sample",
      consentId: "demo-consent-tech-en",
      platform: VcPlatform.YouTube,
      language: VcLanguage.English,
      voiceLibraryType: VoiceLibraryType.Professional,
      sampleHint: "Introducing VC Test Product — the solution for professional voice cloning planning.",
      voiceType: VoiceType.Professional,
      sourceEmotion: EmotionType.Professional,
      durationMs: 50000,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.authorizationCompliant).toBe(true);
    expect(result.record?.scores.voiceSimilarityScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.profile.voiceProfileId).toBeTruthy();

    await core.stop();
  });

  it("rejects cloning without authorization", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getVoiceCloningGenerationEngine();
    const result = await engine.generateCloningPlan({
      voiceSampleId: "vc-unauthorized-sample",
      consentId: "invalid-consent-id",
      sampleHint: "Unauthorized voice sample attempt.",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("authorization");

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getVoiceCloningGenerationEngine();
    await engine.generateCloningPlan({
      voiceSampleId: "vc-search-sample",
      consentId: "demo-consent-tech-en",
      sampleHint: "Search test voice sample for KWIZERA voice cloning engine validation.",
      brandName: "KWIZERA",
      platform: VcPlatform.MobileApp,
    });

    const results = engine.searchCloningPlans({ keywords: "kwizera" });
    expect(results.length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.cloningPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
