import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  DetectedObjectType,
  ImageAnalysisType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-object-detection-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "od-test-image",
  imageName: "Object Detection Test Hero",
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
  visual: { sharpness: 85, dominantColors: ["#000000", "#ffffff"] },
  content: {
    background: "studio-white",
    foreground: "Test Product",
    products: ["Test Product"],
    logos: ["TestBrand"],
  },
  tags: ["test"],
  keywords: ["hero", "test"],
};

describe("AiObjectDetectionIntelligenceEngine", () => {
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
    await core.start("object-detection-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getObjectDetectionIntelligenceEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("object-detection-intelligence");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("detects objects after analysis and understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({
      imageId: "od-test-image",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
    });

    const result = await foundation.getObjectDetectionIntelligenceEngine().detectObjects({
      imageId: "od-test-image",
    });

    expect(result.success).toBe(true);
    expect(result.record?.objects.length).toBeGreaterThan(0);
    expect(result.record?.productDetection.mainProduct).toBe("Test Product");
    expect(result.record?.logoDetection.logoPresent).toBe(true);
    expect(result.record?.validated).toBe(true);
    expect(result.record?.scores.objectDetectionScore).toBeGreaterThan(55);

    await core.stop();
  });

  it("rejects detection without prior analysis and understanding", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getObjectDetectionIntelligenceEngine()
      .detectObjects({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches detections by product and object type", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({ imageId: "od-test-image" });
    await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: "od-test-image" });

    const engine = foundation.getObjectDetectionIntelligenceEngine();
    const byProduct = engine.searchDetections({ product: "Test Product" });
    const byLogo = engine.searchDetections({ objectType: DetectedObjectType.Logo });

    expect(byProduct.length).toBeGreaterThan(0);
    expect(byLogo.length).toBeGreaterThan(0);

    await core.stop();
  });

});
