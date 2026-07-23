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
  RENDER_OUTPUT_PLATFORM_TARGETS,
  StoryboardGenerationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-rendering-preparation-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "rp-test-product",
  productName: "Rendering Preparation Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "SaaS product for rendering preparation validation",
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
    productId: "rp-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "rp-test-product" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "rp-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "rp-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "rp-test-product" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "rp-test-product",
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

  return story.record!.storyboardId;
}

describe("AiRenderingPreparationEngine", () => {
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
    await core.start("rendering-preparation-test");

    const engine = core.getManager().videoGenerationFoundation!.getRenderingPreparationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("rendering-planning-generation-engine");
    expect(module?.implemented).toBe(true);
  });

  it("prepares render plans from full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("rendering-preparation-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getRenderingPreparationEngine();
    const result = await engine.prepareRenderPlans({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.plans!.length).toBeGreaterThanOrEqual(1);
    expect(result.plans!.every((p) => p.validated)).toBe(true);
    expect(result.plans![0].renderValidation.allValidated).toBe(true);
    expect(result.plans![0].dependencyValidation.allDependenciesReady).toBe(true);
    expect(result.plans![0].outputProfiles.length).toBe(RENDER_OUTPUT_PLATFORM_TARGETS.length);
    expect(result.plans![0].scores.renderReadinessScore).toBeGreaterThanOrEqual(55);
  });

  it("rejects preparation without upstream production plans", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("rendering-preparation-test");

    const engine = core.getManager().videoGenerationFoundation!.getRenderingPreparationEngine();
    const result = await engine.prepareRenderPlans({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by codec and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("rendering-preparation-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getRenderingPreparationEngine();
    await engine.prepareRenderPlans({ storyboardId });

    const byProduct = engine.searchRenderPlans({ productId: "rp-test-product" });
    expect(byProduct.length).toBeGreaterThanOrEqual(1);

    const byCodec = engine.searchRenderPlans({ codec: "H.264" });
    expect(byCodec.length).toBeGreaterThanOrEqual(1);
  });
});
