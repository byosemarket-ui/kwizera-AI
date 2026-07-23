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
  SceneType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-scene-gen-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "sc-test-product",
  productName: "Scene Generation Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "A SaaS product for scene generation validation",
  features: ["automation", "analytics"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["saas", "test"],
};

async function preparePipeline(
  piFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  genFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoGenerationFoundation"]>
): Promise<string> {
  await piFoundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
  await piFoundation.getProductUnderstandingEngine().understandProduct({
    productId: "sc-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "sc-test-product",
  });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "sc-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "sc-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "sc-test-product",
  });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "sc-test-product",
    platform: StoryboardGenerationPlatform.Website,
  });

  expect(story.success).toBe(true);
  return story.record!.storyboardId;
}

describe("AiSceneGenerationEngine", () => {
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
    await core.start("scene-gen-test");

    const engine = core.getManager().videoGenerationFoundation!.getSceneGenerationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("scene-generation-engine");
    expect(module?.implemented).toBe(true);
    expect(module?.status).toBe("active");
  });

  it("generates scene blueprints from approved storyboard", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("scene-gen-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(core.getManager().productIntelligenceFoundation!, genFoundation);

    const engine = genFoundation.getSceneGenerationEngine();
    const result = await engine.generateScenes({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.scenes!.length).toBeGreaterThanOrEqual(4);
    expect(result.scenes!.every((s) => s.validated)).toBe(true);
    expect(result.scenes!.every((s) => s.shots.length >= 1)).toBe(true);
    expect(result.scenes![0].visualPlan.composition.length).toBeGreaterThan(0);
    expect(result.scenes![0].platformOptimizations.length).toBeGreaterThanOrEqual(7);
  });

  it("rejects generation without approved storyboard", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("scene-gen-test");

    const engine = core.getManager().videoGenerationFoundation!.getSceneGenerationEngine();
    const result = await engine.generateScenes({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by storyboard and scene type", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("scene-gen-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(core.getManager().productIntelligenceFoundation!, genFoundation);

    const engine = genFoundation.getSceneGenerationEngine();
    await engine.generateScenes({ storyboardId });

    const byStoryboard = engine.searchScenes({ storyboardId });
    expect(byStoryboard.length).toBeGreaterThanOrEqual(4);

    const byType = engine.searchScenes({ sceneType: SceneType.ProductShowcase });
    expect(byType.length).toBeGreaterThanOrEqual(1);
  });
});
