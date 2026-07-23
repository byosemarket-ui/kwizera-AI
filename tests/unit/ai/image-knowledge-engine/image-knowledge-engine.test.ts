import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore, CreativeStyle, ImageType } from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-image-knowledge-test-"));
}

describe("AiImageKnowledgeEngine", () => {
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

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("image-knowledge-test");
    const engine = core.getManager().knowledgeFoundation!.getImageKnowledgeEngine();
    return { core, engine };
  }

  it("initializes with knowledge foundation", async () => {
    const { core, engine } = await startCore();
    expect(engine.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(fs.existsSync(path.join(storageRoot, "logs", `image-knowledge-engine-${logDate}.jsonl`))).toBe(
      true
    );

    await core.stop();
  });

  it("analyzes sample image and stores knowledge", async () => {
    const { core, engine } = await startCore();

    const result = await engine.analyzeImage({
      imageId: "test-product-hero",
      imagePath: "samples/test-product-hero.png",
      imageName: "Test Product Hero",
      imageType: ImageType.Product,
      product: "Test Product",
      brandName: "KWIZERA",
      metrics: { sharpness: 90, compositionQuality: 85, noise: 10 },
      design: { creativeStyle: CreativeStyle.Modern, visualBalance: 85 },
      brandInfo: { brandIdentity: "KWIZERA", brandConsistency: 88 },
      tags: ["test", "product"],
    });

    expect(result.success).toBe(true);
    expect(result.record?.scores.imageQualityScore).toBeGreaterThan(70);
    expect(result.record?.knowledgeId).toContain("image-knowledge");

    await core.stop();
  });

  it("detects relationships between similar images", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeImage({
      imageId: "rel-image-a",
      imagePath: "samples/a.png",
      imageName: "Brand Image A",
      brandName: "KWIZERA",
      design: { creativeStyle: CreativeStyle.Modern, layout: "grid" },
      tags: ["kwizera"],
    });

    await engine.analyzeImage({
      imageId: "rel-image-b",
      imagePath: "samples/b.png",
      imageName: "Brand Image B",
      brandName: "KWIZERA",
      design: { creativeStyle: CreativeStyle.Modern, layout: "grid" },
      tags: ["kwizera"],
    });

    const rels = engine.detectRelationships("rel-image-a");
    expect(rels?.similarBrands.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("generates recommendations and supports search", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeImage({
      imageId: "rec-image",
      imagePath: "samples/rec.png",
      imageName: "Low Brightness Image",
      brandName: "KWIZERA",
      metrics: { brightness: 50, compositionQuality: 60, sharpness: 70, noise: 20 },
    });

    const recs = engine.getRecommendations("rec-image");
    expect(recs.length).toBeGreaterThan(0);

    const search = await engine.searchImages({ brand: "KWIZERA" });
    expect(search.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects invalid and low-quality analysis", async () => {
    const { core, engine } = await startCore();

    const invalid = await engine.analyzeImage({ imagePath: "", imageName: "" });
    expect(invalid.success).toBe(false);

    const lowQuality = await engine.analyzeImage({
      imagePath: "samples/bad.png",
      imageName: "Bad Image",
      metrics: { sharpness: 20, compositionQuality: 20, noise: 80 },
    });
    expect(lowQuality.success).toBe(false);

    await core.stop();
  });
});
