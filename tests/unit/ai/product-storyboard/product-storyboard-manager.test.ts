import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../../../../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { ProductScenePlanningManager } from "../../../../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../../../../ai/product-storyboard/product-storyboard-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-storyboard-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Storyboard Bottle");
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
  const manager = new ProductStoryboardManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
  });
  return { project, manager };
}

describe("ProductStoryboardManager", () => {
  it("generates storyboard panels and marketing/voice/visual scripts from Steps 1–3 without video", async () => {
    const { project, manager } = await setup();
    const board = await manager.generateStoryboardAndScript(project.id);
    expect(board.creativePipelineStep).toBe(4);
    expect(board.videoGenerationDeferred).toBe(true);
    expect(board.promptOrchestrationDeferred).toBe(true);
    expect(board.totalScenes).toBeGreaterThanOrEqual(4);
    expect(board.panels.every((panel) => panel.assetId && panel.voice.narration && panel.visual.cameraInstructions)).toBe(true);
    expect(board.marketingScript.openingHook).toBeTruthy();
    expect(board.marketingScript.callToAction).toContain("Shop");
    expect(board.quality.ctaPlacementScore).toBeGreaterThanOrEqual(70);
    expect(board.quality.marketingFlowScore).toBeGreaterThanOrEqual(70);

    const explained = await manager.explainStoryboard(project.id);
    expect(explained.storyboardDecisions.length).toBe(board.totalScenes);
    expect(manager.getAiMeProductStoryboardAwareness().canRecommendImprovements).toBe(true);

    const again = await manager.generateStoryboardAndScript(project.id);
    expect(again.cached).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
