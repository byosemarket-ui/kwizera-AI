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
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-image-understanding-test-"));
}

const ANALYSIS_SAMPLE = {
  imageId: "iu-test-image",
  imageName: "Understanding Test Hero",
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
  content: { background: "studio-white", foreground: "Test Product", products: ["Test Product"], logos: ["TestBrand"] },
  tags: ["test"],
  keywords: ["hero", "test"],
};

describe("AiImageUnderstandingEngine", () => {
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
    await core.start("image-understanding-test");

    const engine = core.getManager().imageIntelligenceFoundation!.getImageUnderstandingEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core.getManager().imageIntelligenceFoundation!.getRegistry().getModule("image-understanding-engine");
    expect(mod?.implemented).toBe(true);

    await core.stop();
  });

  it("understands image after analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);

    const result = await foundation.getImageUnderstandingEngine().understandImage({
      imageId: "iu-test-image",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.imageUnderstandingScore).toBeGreaterThan(55);
    expect(result.record?.scene.sceneType).toBeDefined();
    expect(result.record?.validated).toBe(true);

    await core.stop();
  });

  it("rejects understanding without prior analysis", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const result = await core
      .getManager()
      .imageIntelligenceFoundation!.getImageUnderstandingEngine()
      .understandImage({ imageId: "missing-image" });

    expect(result.success).toBe(false);

    await core.stop();
  });

  it("searches understanding by purpose and brand", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageIntelligenceFoundation!;
    await foundation.getImageAnalysisEngine().analyzeImage(ANALYSIS_SAMPLE);
    await foundation.getImageUnderstandingEngine().understandImage({
      imageId: "iu-test-image",
    });

    const engine = foundation.getImageUnderstandingEngine();
    const byPurpose = engine.searchUnderstanding({ imagePurpose: "Showcase" });
    const byBrand = engine.searchUnderstanding({ brand: "TestBrand" });

    expect(byPurpose.length).toBeGreaterThan(0);
    expect(byBrand.length).toBeGreaterThan(0);

    await core.stop();
  });
});
