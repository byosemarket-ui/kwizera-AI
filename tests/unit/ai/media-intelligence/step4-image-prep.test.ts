import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { MediaIntelligenceManager } from "../../../../ai/media-intelligence/media-intelligence-manager.js";
import { resolveProductionImagePath } from "../../../../ai/media-intelligence/asset-resolver.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { CanonicalProductManager } from "../../../../ai/product-record/canonical-product-manager.js";
import {
  buildNormalizedProductCutout,
  isProductionSafeDerivedForeground,
  PREPARATION_METHOD,
} from "../../../../ai/product-asset-preparation/png-canvas.js";
import { productOnWhitePngBase64 } from "../product-asset-preparation/fixtures.js";

const CORE_STUB = undefined as unknown as AiCoreManager;

describe("source-preserving cutout", () => {
  it("keeps product RGB close to the source product region", () => {
    const sourceBytes = Buffer.from(productOnWhitePngBase64(64, 64), "base64");
    const canvas = buildNormalizedProductCutout({ sourceBytes, maxEdge: 64, softEdges: true });
    expect(canvas).not.toBeNull();
    expect(canvas!.method).toBe(PREPARATION_METHOD);
    // Sample center product pixel — should remain brown-ish, not hash noise.
    const cx = Math.floor(canvas!.width / 2);
    const cy = Math.floor(canvas!.height / 2);
    const i = (cy * canvas!.width + cx) * 4;
    expect(canvas!.rgba[i]).toBeGreaterThan(80);
    expect(canvas!.rgba[i]).toBeLessThan(160);
    expect(canvas!.rgba[i + 1]).toBeLessThan(110);
    expect(canvas!.rgba[i + 3]).toBeGreaterThan(200);
  });
});

describe("production asset resolver safety", () => {
  it("rejects tiny legacy placeholders", () => {
    expect(isProductionSafeDerivedForeground({
      width: 256,
      height: 256,
      fileName: "foreground-product.png",
      processingStatus: "ready",
      derivedKind: "analyzed",
    })).toBe(false);
  });

  it("accepts source-preserving derived foregrounds", () => {
    expect(isProductionSafeDerivedForeground({
      width: 128,
      height: 128,
      fileName: `foreground-${PREPARATION_METHOD}-product.png`,
      processingStatus: "ready",
      derivedKind: "analyzed",
    })).toBe(true);
  });

  it("falls back to original when derived is unsafe", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-resolver-"));
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("Resolver");
    const original = await workspace.uploadImage(project.id, {
      fileName: "shoe.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(96, 96),
    });
    await workspace.registerDerivedAsset(project.id, {
      fileName: "foreground-legacy.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(32, 32),
      width: 32,
      height: 32,
      parentAssetId: original.id,
      assetType: "derived-image",
      derivedKind: "analyzed",
    });
    const resolved = await resolveProductionImagePath(workspace, project.id, original.id);
    expect(resolved?.source).toBe("original");
    expect(resolved?.assetId).toBe(original.id);
    await fs.rm(root, { recursive: true, force: true });
  });
});

describe("media report preparationDecision", () => {
  it("includes preparationDecision on getReport assets", async () => {
    const storage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-prep-decision-"));
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

    const project = await workspace.createProject("Prep Decision");
    await workspace.uploadImage(project.id, {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(64, 64),
    });
    await media.prepareProject(project.id);
    const report = await media.getReport(project.id);
    expect(report.pipelineVersion).toBe("step6-asset-prep-v1");
    expect(report.assets[0]?.preparationDecision).toBeTruthy();
    expect([
      "KEEP_ORIGINAL",
      "REMOVE_BACKGROUND",
      "REPLACE_BACKGROUND_LATER",
      "ENHANCE_SOURCE",
      "REFRAME_PRODUCT",
      "REQUEST_USER_ATTENTION",
    ]).toContain(report.assets[0]?.preparationDecision);

    await fs.rm(storage, { recursive: true, force: true });
  });
});
