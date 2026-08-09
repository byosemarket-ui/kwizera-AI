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
import { ProductVideoGenerationManager } from "../../../../ai/product-video-generation/product-video-generation-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-video-gen-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Video Gen Bottle");
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
  const manager = new ProductVideoGenerationManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
    orchestration,
    images: imageGen,
  });
  return { root, project, manager };
}

describe("ProductVideoGenerationManager", () => {
  it("generates product-preserving scene video clips without audio/voice", async () => {
    const { root, project, manager } = await setup();
    const result = await manager.generateProductSceneVideos(project.id);
    expect(result.creativePipelineStep).toBe(7);
    expect(result.audioVoiceDeferred).toBe(true);
    expect(result.originalsUnmodified).toBe(true);
    expect(result.clips.length).toBeGreaterThanOrEqual(4);
    expect(result.clips.every((clip) => clip.productPreserved && clip.cameraMove && clip.effects.length > 0)).toBe(true);
    expect(result.quality.overall).toBeGreaterThanOrEqual(70);
    expect(result.marketingFlowPresent).toContain("hook");
    expect(result.marketingFlowPresent).toContain("call-to-action");

    const absolute = path.join(root, "product-video-generation-runtime", result.clips[0]!.relativePath);
    const svg = await fs.readFile(absolute, "utf8");
    expect(svg.includes("data:image/png;base64,")).toBe(true);
    expect(svg.includes("product preserved")).toBe(true);

    const explained = await manager.explainGeneration(project.id);
    expect(explained.sceneExplanations.length).toBeGreaterThan(0);
    expect(explained.cameraExplanations.length).toBeGreaterThan(0);
    expect(manager.getAiMeProductVideoGenerationAwareness().canExplainVisualEffects).toBe(true);

    const again = await manager.generateProductSceneVideos(project.id);
    expect(again.cached).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
