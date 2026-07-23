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
  ImageQualityPredictionPlatform,
  ImageUnderstandingMarketingGoal,
  ProductionImagePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-quality-prediction-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "qp-test-image",
  imageName: "Quality Prediction Test",
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

async function runFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>
): Promise<void> {
  const imageId = "qp-test-image";
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
  await foundation.getProductionImagePlanningEngine().planProduction({
    imageId,
    platform: ProductionImagePlatform.Website,
  });
}

describe("AiImageQualityPredictionEngine", () => {
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
    await core.start("quality-prediction-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getImageQualityPredictionEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("image-quality-prediction");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("creates quality prediction after complete upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runFullPipeline(foundation);

    const result = await foundation.getImageQualityPredictionEngine().predictQuality({
      imageId: "qp-test-image",
      platform: ImageQualityPredictionPlatform.Website,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.overallImageQualityScore).toBeGreaterThan(55);
    expect(result.record?.predictions.productionSuccessProbability).toBeGreaterThan(50);
    expect(result.record?.highestRiskLevel).not.toBe("critical");
    expect(result.record?.checks.dependencyValidation).toBe(true);
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects prediction without upstream intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getImageQualityPredictionEngine()
      .predictQuality({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches predictions by brand and quality score", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runFullPipeline(foundation);
    await foundation.getImageQualityPredictionEngine().predictQuality({
      imageId: "qp-test-image",
      platform: ImageQualityPredictionPlatform.Website,
    });

    const engine = foundation.getImageQualityPredictionEngine();
    const byBrand = engine.searchQualityPredictions({ brand: "TestBrand" });
    const byScore = engine.searchQualityPredictions({ minQualityScore: 60 });

    expect(byBrand.length).toBeGreaterThan(0);
    expect(byScore.length).toBeGreaterThan(0);

    await core.stop();
  });
});
