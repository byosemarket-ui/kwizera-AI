import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CreativePlatform,
  createAiCore,
  DirectorCameraAngle,
  DirectorShotType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  StoryboardGenerationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-camera-dir-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "cd-test-product",
  productName: "Camera Director Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "SaaS product for camera director validation",
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
    productId: "cd-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "cd-test-product" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "cd-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "cd-test-product",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "cd-test-product" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "cd-test-product",
    platform: StoryboardGenerationPlatform.Website,
  });
  expect(story.success).toBe(true);

  const scenes = await genFoundation.getSceneGenerationEngine().generateScenes({
    storyboardId: story.record!.storyboardId,
  });
  expect(scenes.success).toBe(true);

  return story.record!.storyboardId;
}

describe("AiCameraDirectorEngine", () => {
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
    await core.start("camera-dir-test");

    const engine = core.getManager().videoGenerationFoundation!.getCameraDirectorEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("camera-planning-generation-engine");
    expect(module?.implemented).toBe(true);
  });

  it("generates camera plans from generated scenes", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("camera-dir-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getCameraDirectorEngine();
    const result = await engine.planCamera({ storyboardId });

    expect(result.success).toBe(true);
    expect(result.plans!.length).toBeGreaterThanOrEqual(4);
    expect(result.plans!.every((p) => p.validated)).toBe(true);
    expect(result.plans![0].shotPlans.length).toBeGreaterThanOrEqual(1);
    expect(result.plans![0].focusPlanning.focusSubject.length).toBeGreaterThan(0);
    expect(result.plans![0].platformOptimizations.length).toBeGreaterThanOrEqual(7);
  });

  it("rejects planning without generated scenes", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("camera-dir-test");

    const engine = core.getManager().videoGenerationFoundation!.getCameraDirectorEngine();
    const result = await engine.planCamera({ storyboardId: "nonexistent" });

    expect(result.success).toBe(false);
  });

  it("supports search by angle and shot type", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("camera-dir-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const storyboardId = await preparePipeline(
      core.getManager().productIntelligenceFoundation!,
      genFoundation
    );

    const engine = genFoundation.getCameraDirectorEngine();
    await engine.planCamera({ storyboardId });

    const byAngle = engine.searchCameraPlans({ cameraAngle: DirectorCameraAngle.EyeLevel });
    expect(byAngle.length).toBeGreaterThanOrEqual(1);

    const byShot = engine.searchCameraPlans({ shotType: DirectorShotType.Medium });
    expect(byShot.length).toBeGreaterThanOrEqual(1);
  });
});
