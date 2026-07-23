import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ImageAnalysisType,
  ImageFileFormat,
  PREPARED_IMAGE_INTELLIGENCE_MODULES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-image-analysis-test-"));
}

describe("AiImageAnalysisEngine", () => {
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
    await core.start("image-analysis-engine-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getImageAnalysisEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const registered = core
      .getManager()
      .imageIntelligenceFoundation!.getRegistry()
      .getModule("image-analysis-engine");
    expect(registered?.implemented).toBe(true);

    await core.stop();
  });

  it("analyzes image and stores intelligence record", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().imageIntelligenceFoundation!.getImageAnalysisEngine();
    const result = await engine.analyzeImage({
      imageId: "test-product-hero",
      imageName: "Test Product Hero",
      filePath: "uploads/test-hero.png",
      fileFormat: ImageFileFormat.PNG,
      fileSizeBytes: 500000,
      width: 1920,
      height: 1080,
      imageType: ImageAnalysisType.ProductImage,
      product: "Test Product",
      brand: "TestBrand",
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { sharpness: 85, dominantColors: ["#000000", "#ffffff"] },
      content: { background: "white", products: ["Test Product"] },
      tags: ["test"],
      keywords: ["hero", "product"],
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.imageCompletenessScore).toBeGreaterThan(50);
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects incomplete image analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().imageIntelligenceFoundation!.getImageAnalysisEngine();
    const result = await engine.analyzeImage({ imageId: "incomplete", imageName: "Incomplete" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches images by brand and resolution", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const engine = core.getManager().imageIntelligenceFoundation!.getImageAnalysisEngine();

    await engine.analyzeImage({
      imageId: "search-a",
      imageName: "Brand A Image",
      filePath: "uploads/a.jpg",
      fileFormat: ImageFileFormat.JPEG,
      fileSizeBytes: 300000,
      width: 1920,
      height: 1080,
      imageType: ImageAnalysisType.ProductImage,
      product: "Product A",
      brand: "KWIZERA",
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { dominantColors: ["#111111"] },
      content: { background: "studio" },
      tags: ["test"],
      keywords: ["kwizera"],
    });

    await engine.analyzeImage({
      imageId: "search-b",
      imageName: "Brand B Image",
      filePath: "uploads/b.jpg",
      fileFormat: ImageFileFormat.JPEG,
      fileSizeBytes: 400000,
      width: 1280,
      height: 720,
      imageType: ImageAnalysisType.LifestyleImage,
      product: "Product B",
      brand: "KWIZERA",
      creationDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      visual: { dominantColors: ["#222222"] },
      content: { background: "outdoor" },
      tags: ["test"],
      keywords: ["lifestyle"],
    });

    const brandResults = engine.searchImages({ brand: "KWIZERA" });
    expect(brandResults.length).toBeGreaterThanOrEqual(2);

    const resolutionResults = engine.searchImages({ resolution: "1920x1080" });
    expect(resolutionResults.some((r) => r.imageId === "search-a")).toBe(true);

    await core.stop();
  });

  it("keeps image analysis as first prepared module", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    expect(PREPARED_IMAGE_INTELLIGENCE_MODULES[0]?.moduleId).toBe("image-analysis-engine");

    await core.stop();
  });
});
