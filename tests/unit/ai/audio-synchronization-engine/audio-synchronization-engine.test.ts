import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  AudioSyncPlanType,
  CreativePlatform,
  createAiCore,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  StoryboardGenerationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-audio-sync-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "as-test-product",
  productName: "Audio Sync Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "SaaS product for audio synchronization validation",
  features: ["automation"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["saas"],
};

async function preparePipeline(
  piFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  genFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoGenerationFoundation"]>
): Promise<string> {
  await piFoundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
  await piFoundation.getProductUnderstandingEngine().understandProduct({
    productId: "as-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "as-test-product" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "as-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "as-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "as-test-product" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "as-test-product",
    platform: StoryboardGenerationPlatform.Website,
  });
  expect(story.success).toBe(true);

  const scenes = await genFoundation.getSceneGenerationEngine().generateScenes({
    storyboardId: story.record!.storyboardId,
  });
  expect(scenes.success).toBe(true);

  const camera = await genFoundation.getCameraDirectorEngine().planCamera({
    storyboardId: story.record!.storyboardId,
  });
  expect(camera.success).toBe(true);

  const motion = await genFoundation.getMotionGenerationEngine().generateMotionPlans({
    storyboardId: story.record!.storyboardId,
  });
  expect(motion.success).toBe(true);

  const animation = await genFoundation.getAnimationGenerationEngine().generateAnimationPlans({
    storyboardId: story.record!.storyboardId,
  });
  expect(animation.success).toBe(true);

  const vfx = await genFoundation.getVisualEffectsGenerationEngine().generateVisualEffectPlans({
    storyboardId: story.record!.storyboardId,
  });
  expect(vfx.success).toBe(true);

  return story.record!.storyboardId;
}

describe("AiAudioSynchronizationEngine", () => {
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

  it("initializes and registers with video generation foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("audio-sync-test");

    const engine = core.getManager().videoGenerationFoundation!.getAudioSynchronizationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("audio-sync-generation-engine");
    expect(module?.implemented).toBe(true);
  });

  it("generates audio sync plans from full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("audio-sync-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getAudioSynchronizationEngine();
    const result = await engine.generateAudioSyncPlans({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.plans!.length).toBeGreaterThanOrEqual(4);
    expect(result.plans!.every((p) => p.validated)).toBe(true);
    expect(result.plans![0].sceneSynchronization.motionSync.length).toBeGreaterThanOrEqual(1);
    expect(result.plans![0].platformOptimizations.length).toBeGreaterThanOrEqual(7);
    expect(result.plans![0].scores.audioSynchronizationScore).toBeGreaterThanOrEqual(55);
  });

  it("rejects planning without upstream visual effect plans", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("audio-sync-test");

    const engine = core.getManager().videoGenerationFoundation!.getAudioSynchronizationEngine();
    const result = await engine.generateAudioSyncPlans({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by plan type and storyboard", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("audio-sync-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getAudioSynchronizationEngine();
    await engine.generateAudioSyncPlans({ storyboardId });

    const byStoryboard = engine.searchAudioSyncPlans({ storyboardId });
    expect(byStoryboard.length).toBeGreaterThanOrEqual(4);

    const byType = engine.searchAudioSyncPlans({ planType: AudioSyncPlanType.Combined });
    expect(byType.length).toBeGreaterThanOrEqual(1);
  });
});
