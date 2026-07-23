import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  AccentType,
  EmotionType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  S2sLanguage,
  S2sPlatform,
  VoiceType,
  CreativePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-speech-to-speech-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "s2s-test-product",
  productName: "S2S Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A comprehensive SaaS product for marketing teams requiring speech transformation validation",
  features: ["automation", "narration", "S2S"],
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
    productId: "s2s-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "s2s-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "s2s-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "s2s-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiSpeechToSpeechGenerationEngine", () => {
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
    await core.start("s2s-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getSpeechToSpeechGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("speech-to-speech-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates transformation plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().audioGenerationFoundation!.getSpeechToSpeechGenerationEngine();
    const result = await engine.generateTransformationPlan({
      productId: "s2s-test-product",
      sourceAudioId: "s2s-test-source-audio",
      platform: S2sPlatform.YouTube,
      language: S2sLanguage.English,
      transcriptHint: "Introducing S2S Test Product — the solution for professional speech transformation planning.",
      sourceVoiceType: VoiceType.Male,
      targetVoiceType: VoiceType.Professional,
      sourceAccent: AccentType.American,
      sourceEmotion: EmotionType.Professional,
      durationMs: 40000,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.transformationQualityScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.speechAnalysis.speakerSegments.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("generates transformation plan from source audio only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getSpeechToSpeechGenerationEngine();
    const result = await engine.generateTransformationPlan({
      sourceAudioId: "s2s-standalone-source",
      transcriptHint: "Standalone source narration for brand announcement with clear pronunciation guidance.",
      brandName: "KWIZERA",
      platform: S2sPlatform.Website,
      language: S2sLanguage.English,
      sourceVoiceType: VoiceType.Narrator,
      targetVoiceType: VoiceType.Professional,
    });

    expect(result.success).toBe(true);
    expect(result.record?.timingPreservation.segmentTiming.length).toBeGreaterThanOrEqual(1);
    expect(result.record?.emotionPreservation.emotionalArc.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getSpeechToSpeechGenerationEngine();
    await engine.generateTransformationPlan({
      sourceAudioId: "s2s-search-source",
      transcriptHint: "Search test narration for KWIZERA speech transformation engine validation.",
      brandName: "KWIZERA",
      platform: S2sPlatform.MobileApp,
    });

    const results = engine.searchTransformationPlans({ keywords: "kwizera" });
    expect(results.length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.transformationsGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
