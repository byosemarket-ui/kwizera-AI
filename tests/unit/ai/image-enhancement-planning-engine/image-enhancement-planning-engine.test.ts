import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  EnhancementPlatform,
  ImageAnalysisType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-enhancement-planning-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "ep-test-image",
  imageName: "Enhancement Planning Test",
  filePath: "uploads/test.png",
  fileFormat: ImageFileFormat.PNG,
  fileSizeBytes: 800000,
  width: 1920,
  height: 1080,
  imageType: ImageAnalysisType.ProductImage,
  product: "Test Product",
  brand: "TestBrand",
  category: "commerce",
  creativeStyle: "commercial",
  creationDate: new Date().toISOString(),
  lastModifiedDate: new Date().toISOString(),
  visual: {
    sharpness: 85,
    brightness: 72,
    contrast: 78,
    saturation: 65,
    noiseLevel: 8,
    whiteBalance: 68,
    exposure: 72,
    dominantColors: ["#1a1a2e", "#ffffff"],
  },
  content: {
    background: "studio-white",
    foreground: "Test Product",
    products: ["Test Product"],
    logos: ["TestBrand"],
  },
  tags: ["test"],
  keywords: ["test"],
};

async function runMinimalPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>
): Promise<void> {
  await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
  await foundation.getImageUnderstandingEngine().understandImage({
    imageId: "ep-test-image",
    marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
  });
}

describe("AiImageEnhancementPlanningEngine", () => {
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

  it("initializes and registers with image intelligence foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("enhancement-planning-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getImageEnhancementPlanningEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("image-enhancement-planning");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates enhancement plan after analysis and understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runMinimalPipeline(foundation);

    const result = await foundation.getImageEnhancementPlanningEngine().planEnhancement({
      imageId: "ep-test-image",
      platform: EnhancementPlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.nonDestructive).toBe(true);
    expect(result.record?.enhancementPlan.sharpening).toBeDefined();
    expect(result.record?.restorationPlan.qualityRecovery).toBeDefined();
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scores.enhancementReadinessScore).toBeGreaterThan(55);

    await core.stop();
  });

  it("rejects planning without upstream intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getImageEnhancementPlanningEngine()
      .planEnhancement({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches plans by product and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runMinimalPipeline(foundation);
    await foundation.getImageEnhancementPlanningEngine().planEnhancement({
      imageId: "ep-test-image",
      platform: EnhancementPlatform.Instagram,
    });

    const engine = foundation.getImageEnhancementPlanningEngine();
    const byProduct = engine.searchEnhancementPlans({ product: "Test Product" });
    const byPlatform = engine.searchEnhancementPlans({ platform: EnhancementPlatform.Instagram });

    expect(byProduct.length).toBeGreaterThan(0);
    expect(byPlatform.length).toBeGreaterThan(0);

    await core.stop();
  });
});
