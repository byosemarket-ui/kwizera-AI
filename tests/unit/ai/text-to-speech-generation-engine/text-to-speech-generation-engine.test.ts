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
  TtsLanguage,
  TtsPlatform,
  VoiceType,
  CreativePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-text-to-speech-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "tts-test-product",
  productName: "TTS Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A comprehensive SaaS product for marketing teams requiring speech plan validation",
  features: ["automation", "narration", "TTS"],
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
    productId: "tts-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "tts-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "tts-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "tts-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiTextToSpeechGenerationEngine", () => {
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
    await core.start("tts-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getTextToSpeechGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("text-to-speech-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates speech plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().audioGenerationFoundation!.getTextToSpeechGenerationEngine();
    const result = await engine.generateSpeechPlan({
      productId: "tts-test-product",
      platform: TtsPlatform.YouTube,
      language: TtsLanguage.English,
      text: "Introducing TTS Test Product — the solution for professional narration and speech planning.",
      voiceType: VoiceType.Narrator,
      emotion: EmotionType.Professional,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.pronunciationScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.textAnalysis.language).toBe(TtsLanguage.English);

    await core.stop();
  });

  it("generates speech plan from text only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getTextToSpeechGenerationEngine();
    const result = await engine.generateSpeechPlan({
      text: "Standalone narration script for brand announcement with clear pronunciation guidance.",
      brandName: "KWIZERA",
      platform: TtsPlatform.Website,
      language: TtsLanguage.English,
    });

    expect(result.success).toBe(true);
    expect(result.record?.pronunciationPlan.numberReadingRules.length).toBeGreaterThanOrEqual(2);
    expect(result.record?.naturalnessPlan.pauses.length).toBeGreaterThanOrEqual(3);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getTextToSpeechGenerationEngine();
    await engine.generateSpeechPlan({
      text: "Search test narration for KWIZERA speech planning engine validation.",
      brandName: "KWIZERA",
      platform: TtsPlatform.MobileApp,
    });

    const results = engine.searchSpeechPlans({ keywords: "kwizera" });
    expect(results.length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.speechPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
