import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ImageAnalysisType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
  LightingType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-lighting-color-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "lc-test-image",
  imageName: "Lighting Color Test Hero",
  filePath: "uploads/test-hero.png",
  fileFormat: ImageFileFormat.PNG,
  fileSizeBytes: 800000,
  width: 1920,
  height: 1080,
  imageType: ImageAnalysisType.ProductImage,
  product: "Test Product",
  brand: "TestBrand",
  creativeStyle: "commercial",
  creationDate: new Date().toISOString(),
  lastModifiedDate: new Date().toISOString(),
  visual: {
    sharpness: 85,
    brightness: 72,
    contrast: 78,
    saturation: 65,
    whiteBalance: 68,
    exposure: 72,
    noiseLevel: 8,
    dominantColors: ["#1a1a2e", "#ffffff"],
  },
  content: {
    background: "studio-white",
    foreground: "Test Product",
    products: ["Test Product"],
    logos: ["TestBrand"],
  },
  tags: ["test"],
  keywords: ["hero", "test"],
};

describe("AiLightingColorIntelligenceEngine", () => {
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
    await core.start("lighting-color-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getLightingColorIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("lighting-color-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes lighting and color after analysis and understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({
      imageId: "lc-test-image",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
    });

    const result = await foundation.getLightingColorIntelligenceEngine().analyzeLightingColor({
      imageId: "lc-test-image",
      industry: "technology",
    });

    expect(result.success).toBe(true);
    expect(
      result.record?.lighting.lightingType === LightingType.Studio ||
        result.record?.lighting.lightingType === LightingType.HighKey
    ).toBe(true);
    expect(result.record?.color.dominantColors.length).toBeGreaterThan(0);
    expect(result.record?.lightingPlan.exposureStrategy).toBeDefined();
    expect(result.record?.colorPlan.colorGradingPreparation).toBeDefined();
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scores.lightingQualityScore).toBeGreaterThan(55);

    await core.stop();
  });

  it("rejects analysis without upstream intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getLightingColorIntelligenceEngine()
      .analyzeLightingColor({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches by lighting type and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({ imageId: "lc-test-image" });
    await foundation.getLightingColorIntelligenceEngine().analyzeLightingColor({ imageId: "lc-test-image" });

    const engine = foundation.getLightingColorIntelligenceEngine();
    const byLighting = engine.searchLightingColor({ lightingType: LightingType.Studio });
    const byProduct = engine.searchLightingColor({ product: "Test Product" });

    expect(byLighting.length + engine.searchLightingColor({ lightingType: LightingType.HighKey }).length).toBeGreaterThan(0);
    expect(byProduct.length).toBeGreaterThan(0);

    await core.stop();
  });
});
