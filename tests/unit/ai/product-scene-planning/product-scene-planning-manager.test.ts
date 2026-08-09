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

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-scene-planning-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Scene Bottle");
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
  await assets.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    images,
  });
  const manager = new ProductScenePlanningManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
  });
  return { project, manager };
}

describe("ProductScenePlanningManager", () => {
  it("plans a marketing scene sequence from product profile and prepared assets without storyboard/video", async () => {
    const { project, manager } = await setup();
    const plan = await manager.planProductScenes(project.id);
    expect(plan.creativePipelineStep).toBe(3);
    expect(plan.storyboardGenerationDeferred).toBe(true);
    expect(plan.videoGenerationDeferred).toBe(true);
    expect(plan.sceneCount).toBeGreaterThanOrEqual(4);
    expect(plan.scenes.some((scene) => scene.sceneType === "hero-introduction")).toBe(true);
    expect(plan.scenes.some((scene) => scene.sceneType === "product-reveal")).toBe(true);
    expect(plan.scenes.some((scene) => scene.sceneType === "call-to-action")).toBe(true);
    expect(plan.scenes.every((scene) => scene.productUtilization.length > 0)).toBe(true);
    expect(plan.quality.marketingFlowScore).toBeGreaterThanOrEqual(70);
    expect(plan.quality.cameraPlanningScore).toBeGreaterThanOrEqual(70);
    expect(plan.quality.lightingPlanningScore).toBeGreaterThanOrEqual(70);

    const explained = await manager.explainScenes(project.id);
    expect(explained.sceneExplanations.length).toBe(plan.sceneCount);
    expect(manager.getAiMeProductScenePlanningAwareness().canDetectWeakMarketingFlow).toBe(true);

    const again = await manager.planProductScenes(project.id);
    expect(again.cached).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
