import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CompositionType,
  createAiCore,
  ImageAnalysisType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-composition-intelligence-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "comp-test-image",
  imageName: "Composition Test Hero",
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
  visual: { sharpness: 85, brightness: 70, contrast: 75, dominantColors: ["#000000", "#ffffff"] },
  content: {
    background: "studio-white",
    foreground: "Test Product",
    products: ["Test Product"],
    logos: ["TestBrand"],
  },
  tags: ["test"],
  keywords: ["hero", "test"],
};

describe("AiCompositionIntelligenceEngine", () => {
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
    await core.start("composition-intelligence-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getCompositionIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("composition-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes composition after full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({
      imageId: "comp-test-image",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
    });
    await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: "comp-test-image" });
    await foundation.getBackgroundIntelligenceEngine().analyzeBackground({ imageId: "comp-test-image" });

    const result = await foundation.getCompositionIntelligenceEngine().analyzeComposition({
      imageId: "comp-test-image",
      industry: "technology",
    });

    expect(result.success).toBe(true);
    expect(result.record?.compositionAnalysis.compositionType).toBe(CompositionType.Center);
    expect(result.record?.improvementPlan.cropStrategy).toBeDefined();
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scores.compositionQualityScore).toBeGreaterThan(55);

    await core.stop();
  });

  it("rejects composition analysis without upstream intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getCompositionIntelligenceEngine()
      .analyzeComposition({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches compositions by type and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({ imageId: "comp-test-image" });
    await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: "comp-test-image" });
    await foundation.getBackgroundIntelligenceEngine().analyzeBackground({ imageId: "comp-test-image" });
    await foundation.getCompositionIntelligenceEngine().analyzeComposition({ imageId: "comp-test-image" });

    const engine = foundation.getCompositionIntelligenceEngine();
    const byType = engine.searchCompositions({ compositionType: CompositionType.Center });
    const byProduct = engine.searchCompositions({ product: "Test Product" });

    expect(byType.length).toBeGreaterThan(0);
    expect(byProduct.length).toBeGreaterThan(0);

    await core.stop();
  });
});
