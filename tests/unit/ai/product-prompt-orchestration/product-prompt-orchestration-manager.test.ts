import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { ProductPromptOrchestrationManager } from "../../../../ai/product-prompt-orchestration/product-prompt-orchestration-manager.js";
import { ProductScenePlanningManager } from "../../../../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../../../../ai/product-storyboard/product-storyboard-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-prompt-orch-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Prompt Orch Bottle");
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
  const manager = new ProductPromptOrchestrationManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
  });
  return { project, manager };
}

describe("ProductPromptOrchestrationManager", () => {
  it("builds optimized scene prompts and a swappable model execution plan without generating media", async () => {
    const { project, manager } = await setup();
    const result = await manager.orchestratePromptsAndModels(project.id);
    expect(result.creativePipelineStep).toBe(5);
    expect(result.imageGenerationDeferred).toBe(true);
    expect(result.videoGenerationDeferred).toBe(true);
    expect(result.scenePromptSets.length).toBeGreaterThanOrEqual(4);
    expect(result.scenePromptSets.every((set) => set.prompts.image && set.prompts.video && set.prompts.voice)).toBe(true);
    expect(result.scenePromptSets.every((set) => set.prompts.image.includes(set.assetId))).toBe(true);
    expect(result.modelSelections.every((item) => item.swappable && item.backupModelId)).toBe(true);
    expect(result.executionPlan.tasks.length).toBeGreaterThan(0);
    expect(result.promptConflicts).toHaveLength(0);
    expect(result.quality.overall).toBeGreaterThanOrEqual(70);

    const explained = await manager.explainOrchestration(project.id);
    expect(explained.promptExplanations.length).toBeGreaterThan(0);
    expect(manager.getAiMeProductPromptOrchestrationAwareness().canDetectPromptConflicts).toBe(true);

    const again = await manager.orchestratePromptsAndModels(project.id);
    expect(again.cached).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
