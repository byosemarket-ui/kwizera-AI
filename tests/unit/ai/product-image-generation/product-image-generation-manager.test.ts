import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductImageGenerationManager } from "../../../../ai/product-image-generation/product-image-generation-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { ProductPromptOrchestrationManager } from "../../../../ai/product-prompt-orchestration/product-prompt-orchestration-manager.js";
import { ProductScenePlanningManager } from "../../../../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../../../../ai/product-storyboard/product-storyboard-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-image-gen-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Image Gen Bottle");
  await workspace.updateProject(project.id, {
    productInformation: {
      name: "KWIZERA Steel Bottle",
      category: "Beverage",
      description: "Black insulated stainless steel portable bottle in a studio",
      materials: ["stainless steel"],
      features: ["insulated"],
      price: 39.99,
      currency: "USD",
    },
    brandInformation: { name: "KWIZERA" },
    campaignInformation: { name: "Launch", objective: "Drive awareness", callToAction: "Shop now" },
    targetAudience: "Urban professionals",
  });
  await workspace.uploadImage(project.id, {
    fileName: "bottle-front-studio.png",
    mimeType: "image/png",
    dataBase64: Buffer.alloc(1024, 11).toString("base64"),
  });
  await workspace.uploadImage(project.id, {
    fileName: "bottle-detail-studio.png",
    mimeType: "image/png",
    dataBase64: Buffer.alloc(1024, 13).toString("base64"),
  });
  const images = new ImageIntelligenceManager();
  await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
  const products = new ProductIntelligenceManager();
  await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
  products.attachImageIntelligence(images);
  const assets = new ProductAssetPreparationManager();
  await assets.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, products, images });
  const scenes = new ProductScenePlanningManager();
  await scenes.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, products, assets });
  const storyboards = new ProductStoryboardManager();
  await storyboards.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
  });
  const orchestration = new ProductPromptOrchestrationManager();
  await orchestration.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
  });
  const manager = new ProductImageGenerationManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
    orchestration,
  });
  return { root, project, manager };
}

describe("ProductImageGenerationManager", () => {
  it("generates preserved product scene stills without starting video generation", async () => {
    const { root, project, manager } = await setup();
    const result = await manager.generateProductSceneImages(project.id);
    expect(result.creativePipelineStep).toBe(6);
    expect(result.videoGenerationDeferred).toBe(true);
    expect(result.originalsUnmodified).toBe(true);
    expect(result.images.length).toBeGreaterThanOrEqual(4);
    expect(result.images.every((image) => image.productPreserved && image.backgroundStyle && image.enhancement.sharpness >= 70)).toBe(true);
    expect(result.quality.overall).toBeGreaterThanOrEqual(70);

    const absolute = path.join(root, "product-image-generation-runtime", result.images[0]!.relativePath);
    const png = await fs.readFile(absolute);
    expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);

    const explained = await manager.explainGeneration(project.id);
    expect(explained.imageExplanations.length).toBeGreaterThan(0);
    expect(explained.backgroundExplanations.length).toBeGreaterThan(0);
    expect(manager.getAiMeProductImageGenerationAwareness().canExplainLightingDecisions).toBe(true);

    const again = await manager.generateProductSceneImages(project.id);
    expect(again.cached).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
