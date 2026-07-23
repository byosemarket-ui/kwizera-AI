import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BackgroundType,
  createAiCore,
  ImageAnalysisType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-background-intelligence-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "bg-test-image",
  imageName: "Background Test Hero",
  filePath: "uploads/test-hero.png",
  fileFormat: ImageFileFormat.PNG,
  fileSizeBytes: 800000,
  width: 1920,
  height: 1080,
  imageType: ImageAnalysisType.ProductImage,
  product: "Test Product",
  brand: "TestBrand",
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

describe("AiBackgroundIntelligenceEngine", () => {
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
    await core.start("background-intelligence-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getBackgroundIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("background-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes background after full upstream pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({
      imageId: "bg-test-image",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
    });
    await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: "bg-test-image" });

    const result = await foundation.getBackgroundIntelligenceEngine().analyzeBackground({
      imageId: "bg-test-image",
      industry: "technology",
    });

    expect(result.success).toBe(true);
    expect(result.record?.classification.backgroundType).toBe(BackgroundType.Studio);
    expect(result.record?.replacementPlan.backgroundIsolationPlan).toBeDefined();
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scores.backgroundQualityScore).toBeGreaterThan(55);

    await core.stop();
  });

  it("rejects background analysis without upstream intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getBackgroundIntelligenceEngine()
      .analyzeBackground({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches backgrounds by type and product", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({ imageId: "bg-test-image" });
    await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: "bg-test-image" });
    await foundation.getBackgroundIntelligenceEngine().analyzeBackground({ imageId: "bg-test-image" });

    const engine = foundation.getBackgroundIntelligenceEngine();
    const byType = engine.searchBackgrounds({ backgroundType: BackgroundType.Studio });
    const byProduct = engine.searchBackgrounds({ product: "Test Product" });

    expect(byType.length).toBeGreaterThan(0);
    expect(byProduct.length).toBeGreaterThan(0);

    await core.stop();
  });
});
