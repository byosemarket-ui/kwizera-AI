import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CreativePlatform,
  createAiCore,
  ExportFormat,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  SUPPORTED_EXPORT_FORMATS,
  StoryboardGenerationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-production-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "vp-test-product",
  productName: "Video Production Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "SaaS product for video production validation",
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
    productId: "vp-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "vp-test-product" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "vp-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "vp-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "vp-test-product" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "vp-test-product",
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

  return story.record!.storyboardId;
}

describe("AiVideoProductionEngine", () => {
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
    await core.start("video-production-test");

    const engine = core.getManager().videoGenerationFoundation!.getVideoProductionEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("video-production-generation-engine");
    expect(module?.implemented).toBe(true);
  });

  it("generates production plans from full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("video-production-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getVideoProductionEngine();
    const result = await engine.generateProductionPlans({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.plans!.length).toBeGreaterThanOrEqual(1);
    expect(result.plans!.every((p) => p.validated)).toBe(true);
    expect(result.plans![0].workflowValidation.productionWorkflowValidated).toBe(true);
    expect(result.plans![0].dependencyValidation.allDependenciesReady).toBe(true);
    expect(result.plans![0].exportPreparation.formats.length).toBe(SUPPORTED_EXPORT_FORMATS.length);
    expect(result.plans![0].exportPreparation.primaryFormat).toBe(ExportFormat.Mp4);
    expect(result.plans![0].scores.productionReadinessScore).toBeGreaterThanOrEqual(55);
  });

  it("rejects planning without upstream marketing video plans", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("video-production-test");

    const engine = core.getManager().videoGenerationFoundation!.getVideoProductionEngine();
    const result = await engine.generateProductionPlans({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by workflow and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("video-production-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getVideoProductionEngine();
    await engine.generateProductionPlans({ storyboardId });

    const byProduct = engine.searchProductionPlans({ productId: "vp-test-product" });
    expect(byProduct.length).toBeGreaterThanOrEqual(1);

    const byWorkflow = engine.searchProductionPlans({ workflow: "timeline" });
    expect(byWorkflow.length).toBeGreaterThanOrEqual(1);
  });
});
