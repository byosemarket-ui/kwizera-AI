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
  ImageColorSpace,
  ImageCompressionType,
  ImageFileFormat,
  ImageQualityPredictionPlatform,
  ImageUnderstandingMarketingGoal,
  ImageUnderstandingPlatform,
  ProductionImagePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ii-optimization-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "iio-test-hero",
  imageName: "II Optimization Test Hero",
  filePath: "uploads/test-hero.png",
  fileFormat: ImageFileFormat.PNG,
  fileSizeBytes: 850_000,
  width: 1920,
  height: 1080,
  colorSpace: ImageColorSpace.SRGB,
  bitDepth: 8,
  compressionType: ImageCompressionType.Lossless,
  visual: {
    brightness: 70,
    contrast: 75,
    saturation: 65,
    sharpness: 85,
    noiseLevel: 10,
    whiteBalance: 68,
    exposure: 70,
    dominantColors: ["#1a1a2e", "#ffffff"],
  },
  content: {
    products: ["Test Product"],
    background: "studio",
    logos: ["TestBrand"],
  },
  imageType: ImageAnalysisType.ProductImage,
  product: "Test Product",
  brand: "TestBrand",
  category: "commerce",
  creativeStyle: "commercial",
  tags: ["test"],
  keywords: ["test", "hero"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>
): Promise<void> {
  const imageId = "iio-test-hero";
  await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
  await foundation.getImageUnderstandingEngine().understandImage({
    imageId,
    marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
    platform: ImageUnderstandingPlatform.Ecommerce,
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
  await foundation.getImageQualityPredictionEngine().predictQuality({
    imageId,
    projectId: "iio-test",
    platform: ImageQualityPredictionPlatform.Website,
  });
}

describe("AiImageIntelligenceOptimizationEngine", () => {
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
    await core.start("ii-optimization-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getImageIntelligenceOptimizationEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .imageIntelligenceFoundation!.getRegistry()
      .getModule("image-intelligence-optimization");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("runs optimization after full image intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const result = await foundation.getImageIntelligenceOptimizationEngine().runOptimization({
      imageId: "iio-test-hero",
    });

    expect(result.success).toBe(true);
    expect(result.record?.moduleResults.length).toBe(11);
    expect(result.record?.moduleResults.every((m) => m.qualityScoreAfter >= m.qualityScoreBefore)).toBe(true);
    expect(result.record?.scores.overallImprovementScore).toBeGreaterThanOrEqual(5);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.recoveryPointId).toBeTruthy();
    expect(result.recovered).not.toBe(true);

    await core.stop();
  });

  it("rejects optimization without upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getImageIntelligenceOptimizationEngine()
      .runOptimization({ imageId: "missing-image" });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches optimizations by brand and improvement score", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await prepareFullPipeline(foundation);
    await foundation.getImageIntelligenceOptimizationEngine().runOptimization({ imageId: "iio-test-hero" });

    const engine = foundation.getImageIntelligenceOptimizationEngine();
    const byBrand = engine.searchOptimizations({ brand: "TestBrand" });
    const byScore = engine.searchOptimizations({ minImprovementScore: 5 });

    expect(byBrand.length).toBeGreaterThanOrEqual(1);
    expect(byScore.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
