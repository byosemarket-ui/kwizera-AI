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
import { ProductScenePlanningManager } from "../../../../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../../../../ai/product-storyboard/product-storyboard-manager.js";
import { ProductVideoGenerationManager } from "../../../../ai/product-video-generation/product-video-generation-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-audio-gen-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Audio Gen Bottle");
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
  const manager = new ProductAudioGenerationManager();
  await manager.initialize(root, {
    core: undefined as unknown as AiCoreManager,
    workspace,
    products,
    assets,
    scenes,
    storyboards,
    orchestration,
    videos: videoGen,
  });
  return { root, project, manager };
}

describe("ProductAudioGenerationManager", () => {
  it("generates synced voice, music, and effects without rendering final video", async () => {
    const { root, project, manager } = await setup();
    const result = await manager.generateProductAudio(project.id);
    expect(result.creativePipelineStep).toBe(8);
    expect(result.renderingDeferred).toBe(true);
    expect(result.copyrightSafe).toBe(true);
    expect(result.voice.persona).toBeTruthy();
    expect(result.music.licensedOrGenerated).toBe("generated-offline");
    expect(result.narrationCues.length).toBeGreaterThanOrEqual(4);
    expect(result.mix.musicVolume).toBeLessThan(result.mix.voiceVolume);
    expect(result.sync.problems).toHaveLength(0);
    expect(result.quality.overall).toBeGreaterThanOrEqual(70);

    const mix = result.assets.find((asset) => asset.kind === "mix");
    expect(mix).toBeTruthy();
    const wav = await fs.readFile(path.join(root, "product-audio-generation-runtime", mix!.relativePath));
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");

    const explained = await manager.explainGeneration(project.id);
    expect(explained.voiceExplanation.length).toBeGreaterThan(0);
    expect(manager.getAiMeProductAudioGenerationAwareness().canExplainSoundEffects).toBe(true);

    const again = await manager.generateProductAudio(project.id);
    expect(again.cached).toBe(true);

    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
