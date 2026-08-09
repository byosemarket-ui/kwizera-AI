import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductAudioGenerationManager } from "../../../../ai/product-audio-generation/product-audio-generation-manager.js";
import { ProductImageGenerationManager } from "../../../../ai/product-image-generation/product-image-generation-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { ProductPromptOrchestrationManager } from "../../../../ai/product-prompt-orchestration/product-prompt-orchestration-manager.js";
import { ProductRenderingExportManager } from "../../../../ai/product-rendering-export/product-rendering-export-manager.js";
import { ProductScenePlanningManager } from "../../../../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../../../../ai/product-storyboard/product-storyboard-manager.js";
import { ProductVideoGenerationManager } from "../../../../ai/product-video-generation/product-video-generation-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => {
    try {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* best-effort cleanup on Windows locks */
    }
  }));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-render-export-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Render Export Bottle");
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
    platform: "instagram",
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
  const imageGen = new ProductImageGenerationManager();
  await imageGen.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
    orchestration,
  });
  const videoGen = new ProductVideoGenerationManager();
  await videoGen.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
    orchestration,
    images: imageGen,
  });
  const audioGen = new ProductAudioGenerationManager();
  await audioGen.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
    orchestration,
    videos: videoGen,
  });
  const manager = new ProductRenderingExportManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
    orchestration,
    videos: videoGen,
    audio: audioGen,
  });
  return { root, project, manager };
}

describe("ProductRenderingExportManager", () => {
  it("renders offline delivery packages with platform presets without certification", { timeout: 300_000 }, async () => {
    const { root, project, manager } = await setup();
    const result = await manager.renderAndPackage(project.id);
    expect(result.creativePipelineStep).toBe(9);
    expect(result.certificationDeferred).toBe(true);
    expect(result.originalsUnmodified).toBe(true);
    expect(result.platforms.length).toBeGreaterThanOrEqual(7);
    expect(result.quality.overall).toBeGreaterThanOrEqual(70);
    expect(result.composition.includesVideo).toBe(true);
    expect(result.composition.includesCta).toBe(true);

    const finalPath = path.join(root, "product-rendering-export-runtime", result.artifacts.finalVideoRelativePath);
    const svg = await fs.readFile(finalPath, "utf8");
    expect(svg.includes("<svg")).toBe(true);
    expect(svg.includes("Shop now") || svg.includes("Shop")).toBe(true);

    const mix = await fs.readFile(path.join(root, "product-rendering-export-runtime", result.artifacts.audioRelativePath));
    expect(mix.subarray(0, 4).toString("ascii")).toBe("RIFF");

    const explained = await manager.explainRender(project.id);
    expect(explained.platformComparisons.length).toBeGreaterThanOrEqual(7);
    expect(manager.getAiMeProductRenderingExportAwareness().canRerenderFromHistory).toBe(true);

    const again = await manager.renderAndPackage(project.id);
    expect(again.cached).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
