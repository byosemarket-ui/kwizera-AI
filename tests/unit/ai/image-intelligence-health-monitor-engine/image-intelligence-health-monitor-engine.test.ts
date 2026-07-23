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
  MonitoredImageIntelligenceModule,
  ProductionImagePlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ii-health-monitor-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "iihm-test-hero",
  imageName: "II Health Monitor Test Hero",
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
  const imageId = "iihm-test-hero";
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
    projectId: "iihm-test",
    platform: ImageQualityPredictionPlatform.Website,
  });
  await foundation.getImageIntelligenceOptimizationEngine().runOptimization({ imageId });
}

describe("AiImageIntelligenceHealthMonitorEngine", () => {
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
    await core.start("ii-health-monitor-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getImageIntelligenceHealthMonitorEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .imageIntelligenceFoundation!.getRegistry()
      .getModule("image-intelligence-health-monitor");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("runs health check after full image intelligence pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const check = await foundation.getImageIntelligenceHealthMonitorEngine().runHealthCheck();

    expect(check.overallScore).toBeGreaterThanOrEqual(75);
    expect(check.moduleScores.length).toBeGreaterThanOrEqual(18);
    expect(check.moduleScores.find((m) => m.module === MonitoredImageIntelligenceModule.ImageAnalysis)).toBeTruthy();

    await core.stop();
  });

  it("runs audit and generates reports", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const monitor = foundation.getImageIntelligenceHealthMonitorEngine();
    await monitor.runHealthCheck();
    const audit = await monitor.runAudit();
    const paths = monitor.generateReports();

    expect(audit.valid).toBe(true);
    expect(fs.existsSync(paths.healthReportPath)).toBe(true);
    expect(fs.existsSync(paths.historyReportPath)).toBe(true);
    expect(monitor.getHealthHistory().length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("detects simulated corruption warnings", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const analysisPath = path.join(
      foundation.getImageAnalysisEngine().getEngineDir(),
      "image-analysis-records.json"
    );
    const backup = fs.readFileSync(analysisPath, "utf8");
    fs.writeFileSync(analysisPath, "{ corrupted", "utf8");

    const check = await foundation.getImageIntelligenceHealthMonitorEngine().runHealthCheck();
    expect(check.warnings.length > 0 || check.errors.length > 0).toBe(true);

    fs.writeFileSync(analysisPath, backup, "utf8");
    await core.stop();
  });
});
