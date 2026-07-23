import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BrandVisualStyle,
  createAiCore,
  ImageAnalysisType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-brand-visual-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "bv-test-image",
  imageName: "Brand Visual Test Hero",
  filePath: "uploads/test-hero.png",
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
    whiteBalance: 68,
    exposure: 72,
    dominantColors: ["#1a1a2e", "#e94560", "#ffffff"],
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

async function runPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>,
  imageId: string
): Promise<void> {
  await foundation.getImageAnalysisEngine().analyzeImage({ ...ANALYSIS_SAMPLE, imageId });
  await foundation.getImageUnderstandingEngine().understandImage({
    imageId,
    marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId });
  await foundation.getLightingColorIntelligenceEngine().analyzeLightingColor({ imageId });
}

describe("AiBrandVisualIntelligenceEngine", () => {
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
    await core.start("brand-visual-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getBrandVisualIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("brand-visual-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes brand visual after full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runPipeline(foundation, "bv-test-image");

    const result = await foundation.getBrandVisualIntelligenceEngine().analyzeBrandVisual({
      imageId: "bv-test-image",
      brandName: "TestBrand",
      industry: "technology",
      visualStyle: BrandVisualStyle.Technology,
    });

    expect(result.success).toBe(true);
    expect(result.record?.profile.brandName).toBe("TestBrand");
    expect(result.record?.logoAnalysis.logoSafeArea).toBeDefined();
    expect(result.record?.colorAnalysis.primaryBrandColors.length).toBeGreaterThan(0);
    expect(result.record?.typography.primaryFont).toBeDefined();
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scores.brandConsistencyScore).toBeGreaterThan(55);

    await core.stop();
  });

  it("rejects brand visual analysis without upstream intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getBrandVisualIntelligenceEngine()
      .analyzeBrandVisual({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches brand visual by brand and color", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await runPipeline(foundation, "bv-test-image");
    await foundation.getBrandVisualIntelligenceEngine().analyzeBrandVisual({
      imageId: "bv-test-image",
      brandName: "TestBrand",
    });

    const engine = foundation.getBrandVisualIntelligenceEngine();
    const byBrand = engine.searchBrandVisual({ brand: "TestBrand" });
    const byColor = engine.searchBrandVisual({ color: "#e94560" });

    expect(byBrand.length).toBeGreaterThan(0);
    expect(byColor.length).toBeGreaterThan(0);

    await core.stop();
  });
});
