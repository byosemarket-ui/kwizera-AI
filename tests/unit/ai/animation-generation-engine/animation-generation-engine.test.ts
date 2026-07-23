import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  AnimationPlanType,
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
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-animation-gen-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "ag-test-product",
  productName: "Animation Generation Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "SaaS product for animation generation validation",
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
    productId: "ag-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "ag-test-product" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "ag-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "ag-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "ag-test-product" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "ag-test-product",
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

  return story.record!.storyboardId;
}

describe("AiAnimationGenerationEngine", () => {
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
    await core.start("animation-gen-test");

    const engine = core.getManager().videoGenerationFoundation!.getAnimationGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("animation-planning-generation-engine");
    expect(module?.implemented).toBe(true);
  });

  it("generates animation plans from scenes, camera plans, and motion plans", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("animation-gen-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getAnimationGenerationEngine();
    const result = await engine.generateAnimationPlans({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.plans!.length).toBeGreaterThanOrEqual(4);
    expect(result.plans!.every((p) => p.validated)).toBe(true);
    expect(result.plans![0].synchronization.motionSync.length).toBeGreaterThanOrEqual(1);
    expect(result.plans![0].platformOptimizations.length).toBeGreaterThanOrEqual(7);
    expect(result.plans![0].scores.animationQualityScore).toBeGreaterThanOrEqual(55);
  });

  it("rejects planning without upstream motion plans", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("animation-gen-test");

    const engine = core.getManager().videoGenerationFoundation!.getAnimationGenerationEngine();
    const result = await engine.generateAnimationPlans({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by animation type and storyboard", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("animation-gen-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getAnimationGenerationEngine();
    await engine.generateAnimationPlans({ storyboardId });

    const byStoryboard = engine.searchAnimationPlans({ storyboardId });
    expect(byStoryboard.length).toBeGreaterThanOrEqual(4);

    const byType = engine.searchAnimationPlans({ planType: AnimationPlanType.Combined });
    expect(byType.length).toBeGreaterThanOrEqual(1);
  });
});
