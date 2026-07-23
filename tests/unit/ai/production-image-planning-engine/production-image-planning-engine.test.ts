import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  CreativeImagePlatform,
  CreativeLayoutType,
  EnhancementPlatform,
  ImageAnalysisType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
  ProductionImagePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-production-planning-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "pp-test-image",
  imageName: "Production Planning Test",
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

async function runCompletePipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>
): Promise<void> {
  const imageId = "pp-test-image";
  await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
  await foundation.getImageUnderstandingEngine().understandImage({
    imageId,
    marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId });
  await foundation.getBackgroundIntelligenceEngine().analyzeBackground({ imageId });
  await foundation.getCompositionIntelligenceEngine().analyzeComposition({ imageId });
  await foundation.getLightingColorIntelligenceEngine().analyzeLightingColor({ imageId });
  await foundation.getBrandVisualIntelligenceEngine().analyzeBrandVisual({
    imageId,
    brandName: "TestBrand",
  });
  await foundation.getImageEnhancementPlanningEngine().planEnhancement({
    imageId,
    platform: EnhancementPlatform.Website,
  });
  await foundation.getCreativeImageIntelligenceEngine().planCreativeImage({
    imageId,
    platform: CreativeImagePlatform.WebsiteBanner,
    layoutType: CreativeLayoutType.ProductShowcase,
  });
}

describe("AiProductionImagePlanningEngine", () => {
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
    await core.start("production-planning-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getProductionImagePlanningEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("production-image-planning");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates production plan after complete upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runCompletePipeline(foundation);

    const result = await foundation.getProductionImagePlanningEngine().planProduction({
      imageId: "pp-test-image",
      platform: ProductionImagePlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.dependencies.allRequiredPassed).toBe(true);
    expect(result.record?.workflow.renderingPreparation).toBeDefined();
    expect(result.record?.renderPreparation.outputResolution).toBeDefined();
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scores.productionReadinessScore).toBeGreaterThan(55);

    await core.stop();
  });

  it("rejects planning without upstream intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getProductionImagePlanningEngine()
      .planProduction({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches plans by brand and platform", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runCompletePipeline(foundation);
    await foundation.getProductionImagePlanningEngine().planProduction({
      imageId: "pp-test-image",
      platform: ProductionImagePlatform.Website,
    });

    const engine = foundation.getProductionImagePlanningEngine();
    const byBrand = engine.searchProductionPlans({ brand: "TestBrand" });
    const byPlatform = engine.searchProductionPlans({ platform: ProductionImagePlatform.Website });

    expect(byBrand.length).toBeGreaterThan(0);
    expect(byPlatform.length).toBeGreaterThan(0);

    await core.stop();
  });
});
