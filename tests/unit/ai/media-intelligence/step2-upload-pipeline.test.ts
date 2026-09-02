import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { CanonicalProductManager } from "../../../../ai/product-record/canonical-product-manager.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { MediaIntelligenceManager } from "../../../../ai/media-intelligence/media-intelligence-manager.js";
import { decideIsolation } from "../../../../ai/media-intelligence/isolation-policy.js";
import type { ImageIntelligenceProfile } from "../../../../ai/image-intelligence/types.js";
import { productOnWhitePngBase64 } from "../product-asset-preparation/fixtures.js";

const CORE_STUB = undefined as unknown as AiCoreManager;
const PNG = Buffer.from(productOnWhitePngBase64(64, 64), "base64");

function profile(overrides: Partial<ImageIntelligenceProfile> = {}): ImageIntelligenceProfile {
  return {
    id: "p1",
    projectId: "proj",
    imageId: "img1",
    fileName: "shoe.png",
    mimeType: "image/png",
    quality: { score: 85, confidence: 0.9, notes: [], classification: "GOOD" },
    background: {
      type: "Complex Lifestyle",
      removable: true,
      confidence: 0.9,
      complexity: "high",
      removalSuitability: "high",
    },
    boundaries: { detected: true, confidence: 0.9, notes: "" },
    resolution: { tier: "high", estimatedFromBytes: 1000, notes: "" },
    viewRole: "front",
    lighting: "",
    shadows: "",
    reflections: "",
    cameraAngle: "",
    composition: "",
    perspective: "",
    objects: [],
    scene: "",
    defects: [],
    enhancements: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cached: false,
    analysisState: "ready",
    processingState: "ready",
    ...overrides,
  };
}

describe("isolation policy", () => {
  it("skips clean studio backgrounds", () => {
    const decision = decideIsolation(profile({
      background: {
        type: "White Studio",
        removable: true,
        confidence: 0.95,
        complexity: "low",
        removalSuitability: "medium",
      },
    }));
    expect(decision.isolate).toBe(false);
    expect(decision.decision).toBe("KEEP_ORIGINAL");
  });

  it("isolates complex removable backgrounds", () => {
    const decision = decideIsolation(profile());
    expect(decision.isolate).toBe(true);
    expect(decision.decision).toBe("REMOVE_BACKGROUND");
  });
});

describe("Step 2 upload pipeline", () => {
  it("preserves original bytes and links derived foreground to parent", async () => {
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step2-"));
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storage);
    const images = new ImageIntelligenceManager();
    await images.initialize(storage, { core: CORE_STUB, workspace });
    const products = new ProductIntelligenceManager();
    await products.initialize(storage, { core: CORE_STUB, workspace });
    products.attachImageIntelligence(images);
    products.attachImageIntelligence(images);
    const canonical = new CanonicalProductManager();
    await canonical.initialize(storage, { workspace, images, products });
    const assets = new ProductAssetPreparationManager();
    await assets.initialize(storage, {
      core: CORE_STUB,
      workspace,
      products,
      images,
    });
    const media = new MediaIntelligenceManager();
    await media.initialize({ workspace, images, products, canonical, assets });

    const created = await workspace.createProject("Step2 Product");
    const projectId = created.id;
    await workspace.updateProject(projectId, {
      productInformation: {
        name: "Test Shoe",
        category: "Footwear",
        description: "Brown leather shoe product photo",
      },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Awareness" },
      targetAudience: "Shoppers",
    });
    const original = await workspace.uploadImage(projectId, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: PNG.toString("base64"),
      width: 1,
      height: 1,
    });
    const originalPath = await workspace.getOriginalImagePath(projectId, original.id);
    const beforeHash = createHash("sha256").update(await fs.readFile(originalPath!)).digest("hex");

    await media.processAsset(projectId, original.id);
    const afterHash = createHash("sha256").update(await fs.readFile(originalPath!)).digest("hex");
    expect(afterHash).toBe(beforeHash);

    const prepared = await assets.prepareProductAssets(projectId);
    expect(prepared.assets.length).toBeGreaterThanOrEqual(1);
    expect(prepared.assets.every((asset) => asset.originalPreserved)).toBe(true);

    const project = await workspace.getProject(projectId);
    const derived = project!.productImages.filter((item) => item.parentAssetId === original.id);
    const prepMeta = prepared.assets.find((asset) => asset.sourceImageId === original.id);
    expect(prepMeta?.metadata.workspaceDerivedAssetId || derived.some((item) => item.derivedKind === "analyzed")).toBeTruthy();
    if (derived.length) {
      expect(derived.some((item) => item.derivedKind === "mask")).toBe(true);
    }

    const report = await media.getReport(projectId);
    expect(report.summary.total).toBeGreaterThanOrEqual(1);
    expect(report.assets[0]?.originalPreserved).toBe(true);

    await fs.rm(storage, { recursive: true, force: true });
  });

  it("does not destroy project when isolation fails", async () => {
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step2-fail-"));
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storage);
    const images = new ImageIntelligenceManager();
    await images.initialize(storage, { core: CORE_STUB, workspace });
    const products = new ProductIntelligenceManager();
    await products.initialize(storage, { core: CORE_STUB, workspace });
    products.attachImageIntelligence(images);
    const canonical = new CanonicalProductManager();
    await canonical.initialize(storage, { workspace, images, products });
    const assets = new ProductAssetPreparationManager();
    await assets.initialize(storage, {
      core: CORE_STUB,
      workspace,
      products,
      images,
    });
    const media = new MediaIntelligenceManager();
    await media.initialize({ workspace, images, products, canonical, assets });

    const created = await workspace.createProject("Resilient");
    const projectId = created.id;
    const original = await workspace.uploadImage(projectId, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: PNG.toString("base64"),
    });

    assets.prepareSingleAsset = async () => {
      throw new Error("isolation failed");
    };

    const entry = await media.processAsset(projectId, original.id);
    expect(entry?.originalPreserved).toBe(true);
    const stillThere = await workspace.getOriginalImagePath(projectId, original.id);
    expect(stillThere).toBeTruthy();

    await fs.rm(storage, { recursive: true, force: true });
  });
});
