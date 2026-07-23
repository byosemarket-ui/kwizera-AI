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
  QUALITY_PLATFORM_TARGETS,
  StoryboardGenerationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-quality-validation-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "qv-test-product",
  productName: "Quality Validation Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "SaaS product for quality validation",
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
    productId: "qv-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "qv-test-product" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "qv-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "qv-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "qv-test-product" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "qv-test-product",
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

  return story.record!.storyboardId;
}

describe("AiVideoQualityValidationEngine", () => {
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
    await core.start("quality-validation-test");

    const engine = core.getManager().videoGenerationFoundation!.getVideoQualityValidationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("video-quality-validation-engine");
    expect(module?.implemented).toBe(true);
  });

  it("validates video quality from full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("quality-validation-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getVideoQualityValidationEngine();
    const result = await engine.validateVideoQuality({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.validations!.length).toBeGreaterThanOrEqual(1);
    expect(result.validations!.every((v) => v.validated)).toBe(true);
    expect(result.validations![0].productionReadiness.allInputsReady).toBe(true);
    expect(result.validations![0].platformValidations.length).toBe(QUALITY_PLATFORM_TARGETS.length);
    expect(result.validations![0].scores.overallQualityScore).toBeGreaterThanOrEqual(55);
    expect(result.validations![0].approved).toBe(true);
  });

  it("rejects validation without upstream render plans", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("quality-validation-test");

    const engine = core.getManager().videoGenerationFoundation!.getVideoQualityValidationEngine();
    const result = await engine.validateVideoQuality({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by quality score and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("quality-validation-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getVideoQualityValidationEngine();
    await engine.validateVideoQuality({ storyboardId });

    const byProduct = engine.searchValidations({ productId: "qv-test-product" });
    expect(byProduct.length).toBeGreaterThanOrEqual(1);

    const byScore = engine.searchValidations({ minQualityScore: 55 });
    expect(byScore.length).toBeGreaterThanOrEqual(1);
  });
});
