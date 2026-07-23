import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  MusicGenre,
  MusicMood,
  MusicPlatform,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  SyncTarget,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-music-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "music-test-product",
  productName: "Music Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A comprehensive SaaS product for marketing teams requiring music generation validation",
  features: ["automation", "music", "composition"],
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
    productId: "music-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "music-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "music-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "music-test-product",
    platform: CreativePlatform.YouTube,
  });
}

describe("AiMusicGenerationEngine", () => {
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
    await core.start("music-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    const engine = foundation.getMusicGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = foundation.getRegistry().getModule("music-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");

    await core.stop();
  });

  it("generates music plan from product pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const piFoundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(piFoundation);

    const engine = core.getManager().audioGenerationFoundation!.getMusicGenerationEngine();
    const result = await engine.generateMusicPlan({
      productId: "music-test-product",
      musicPrompt: "Inspirational corporate soundtrack for product launch",
      platform: MusicPlatform.YouTube,
      genre: MusicGenre.Corporate,
      mood: MusicMood.Inspirational,
      syncTarget: SyncTarget.Video,
      videoId: "music-test-video",
      durationSec: 60,
    });

    expect(result.success).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.productionReady).toBe(true);
    expect(result.record?.scores.compositionScore).toBeGreaterThanOrEqual(55);
    expect(result.record?.compositionPlan.chordProgression.length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("generates music plan from prompt only", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getMusicGenerationEngine();
    const result = await engine.generateMusicPlan({
      musicPrompt: "Relaxing lo-fi background music for KWIZERA creative workspace",
      brandName: "KWIZERA",
      platform: MusicPlatform.Website,
      genre: MusicGenre.LoFi,
      mood: MusicMood.Relaxing,
    });

    expect(result.success).toBe(true);
    expect(result.record?.arrangementPlan.activeInstruments.length).toBeGreaterThanOrEqual(2);
    expect(result.record?.moodPlan.emotionalArc.length).toBeGreaterThanOrEqual(3);

    await core.stop();
  });

  it("search and status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().audioGenerationFoundation!.getMusicGenerationEngine();
    await engine.generateMusicPlan({
      musicPrompt: "Search test music for KWIZERA music generation engine validation",
      brandName: "KWIZERA",
      platform: MusicPlatform.Mobile,
      genre: MusicGenre.Pop,
    });

    const results = engine.searchMusicPlans({ keywords: "kwizera" });
    expect(results.length).toBeGreaterThanOrEqual(1);

    const status = engine.buildStatusReport();
    expect(status.readinessScore).toBeGreaterThanOrEqual(85);
    expect(status.musicPlansGenerated).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
