import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { productOnWhitePngBase64 } from "./fixtures.js";

const PRODUCT_PNG = productOnWhitePngBase64(64, 64);

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-asset-prep-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Cutout Bottle");
  await workspace.updateProject(project.id, {
    productInformation: {
      name: "KWIZERA Steel Bottle",
      category: "Beverage",
      description: "Black insulated stainless steel portable bottle in a studio",
      materials: ["stainless steel"],
    },
    brandInformation: { name: "KWIZERA" },
    campaignInformation: { name: "Launch", objective: "Awareness" },
    targetAudience: "Urban professionals",
  });
  await workspace.uploadImage(project.id, {
    fileName: "bottle-front-studio.png",
    mimeType: "image/png",
    dataBase64: PRODUCT_PNG,
  });
  await workspace.uploadImage(project.id, {
    fileName: "bottle-detail-studio.png",
    mimeType: "image/png",
    dataBase64: PRODUCT_PNG,
  });
  const images = new ImageIntelligenceManager();
  await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
  const products = new ProductIntelligenceManager();
  await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
  products.attachImageIntelligence(images);
  const manager = new ProductAssetPreparationManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    images,
  });
  return { root, workspace, project, manager };
}

describe("ProductAssetPreparationManager", () => {
  it("prepares transparent multi-view assets without modifying originals and blocks duplicate fingerprints", async () => {
    const { workspace, project, manager } = await setup();
    const before = await Promise.all(
      (await workspace.getProject(project.id))!.productImages.map(async (image) => {
        const filePath = await workspace.getOriginalImagePath(project.id, image.id);
        return { filePath: filePath!, hash: Buffer.from(await fs.readFile(filePath!)).toString("hex") };
      }),
    );

    const prepared = await manager.prepareProductAssets(project.id);
    expect(prepared.assets).toHaveLength(2);
    expect(prepared.assets.every((asset) => asset.transparency)).toBe(true);
    expect(prepared.assets.every((asset) => asset.quality.backgroundRemoved)).toBe(true);
    expect(prepared.assets.every((asset) => asset.originalPreserved)).toBe(true);
    expect(prepared.missingViews.length).toBeGreaterThan(0);
    expect(prepared.scenePlanningDeferred).toBe(true);

    for (const item of before) {
      const after = Buffer.from(await fs.readFile(item.filePath)).toString("hex");
      expect(after).toBe(item.hash);
    }

    const again = await manager.prepareProductAssets(project.id);
    expect(again.assets).toHaveLength(prepared.assets.length);
    const library = await manager.getLibrary(project.id);
    expect(new Set(library.map((asset) => asset.fingerprint)).size).toBe(library.length);

    const explained = await manager.explainAssetQuality(project.id);
    expect(explained.assetCount).toBe(2);
    expect(manager.getAiMeProductAssetAwareness().canRecommendAdditionalPhotos).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });

  it("normalizes assets into a multi-view library with cleanup metadata and Step 1 plan handoff", async () => {
    const { project, manager } = await setup();
    const prepared = await manager.prepareProductAssets(project.id);
    expect(prepared.creativePipelineStep).toBe(2);
    expect(prepared.multiView.views.front.length + prepared.multiView.views.detail.length).toBeGreaterThan(0);
    expect(prepared.assets.every((asset) => asset.version === 3)).toBe(true);
    expect(prepared.assets.every((asset) => asset.metadata.normalizedPosition === "center")).toBe(true);
    expect(prepared.assets.every((asset) => asset.metadata.cleanupArtifactsRemoved === true)).toBe(true);
    expect(prepared.assets.every((asset) => asset.removalPlan.preserveEdges)).toBe(true);
    expect(prepared.photoRecommendations.length).toBeGreaterThan(0);
    const missing = await manager.detectMissingAngles(project.id);
    expect(missing).toEqual(prepared.missingViews);
  });
});
