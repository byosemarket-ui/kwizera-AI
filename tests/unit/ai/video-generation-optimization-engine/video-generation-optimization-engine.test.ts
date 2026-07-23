import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-optimization-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "opt-test-product",
  productName: "Optimization Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "SaaS product for optimization validation",
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
    productId: "opt-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "opt-test-product" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "opt-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "opt-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "opt-test-product" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "opt-test-product",
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

  const audio = await genFoundation.getAudioSynchronizationEngine().generateAudioSyncPlans({
    storyboardId: story.record!.storyboardId,
  });
  expect(audio.success).toBe(true);

  const marketing = await genFoundation.getMarketingVideoEngine().generateMarketingVideoPlans({
    storyboardId: story.record!.storyboardId,
  });
  expect(marketing.success).toBe(true);

  const production = await genFoundation.getVideoProductionEngine().generateProductionPlans({
    storyboardId: story.record!.storyboardId,
  });
  expect(production.success).toBe(true);

  const rendering = await genFoundation.getRenderingPreparationEngine().prepareRenderPlans({
    storyboardId: story.record!.storyboardId,
  });
  expect(rendering.success).toBe(true);

  const quality = await genFoundation.getVideoQualityValidationEngine().validateVideoQuality({
    storyboardId: story.record!.storyboardId,
  });
  expect(quality.success).toBe(true);

  return story.record!.storyboardId;
}

describe("AiVideoGenerationOptimizationEngine", () => {
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
    await core.start("optimization-test");

    const engine = core.getManager().videoGenerationFoundation!.getVideoGenerationOptimizationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("video-generation-optimization-engine");
    expect(module?.implemented).toBe(true);
  });

  it("optimizes video generation from full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("optimization-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getVideoGenerationOptimizationEngine();
    const result = await engine.optimizeVideoGeneration({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.optimizations!.length).toBeGreaterThanOrEqual(1);
    expect(result.optimizations!.every((o) => o.validated)).toBe(true);
    expect(result.optimizations![0].pipelineOptimization.creativeDecisionsPreserved).toBe(true);
    expect(result.optimizations![0].qualityOptimization.qualityMaintainedOrImproved).toBe(true);
    expect(result.optimizations![0].scores.optimizationScore).toBeGreaterThanOrEqual(55);
    expect(result.optimizations![0].approved).toBe(true);
  });

  it("rejects optimization without upstream validation reports", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("optimization-test");

    const engine = core.getManager().videoGenerationFoundation!.getVideoGenerationOptimizationEngine();
    const result = await engine.optimizeVideoGeneration({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by optimization and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("optimization-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getVideoGenerationOptimizationEngine();
    await engine.optimizeVideoGeneration({ storyboardId });

    const byProduct = engine.searchOptimizations({ productId: "opt-test-product" });
    expect(byProduct.length).toBeGreaterThanOrEqual(1);

    const byOptimization = engine.searchOptimizations({ optimization: "optimized" });
    expect(byOptimization.length).toBeGreaterThanOrEqual(1);
  });
});
