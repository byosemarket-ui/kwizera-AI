import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductImageGenerationManager } from "../ai/product-image-generation/product-image-generation-manager.js";
import { ProductIntelligenceManager } from "../ai/product-intelligence/product-intelligence-manager.js";
import { ProductPromptOrchestrationManager } from "../ai/product-prompt-orchestration/product-prompt-orchestration-manager.js";
import { ProductScenePlanningManager } from "../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../ai/product-storyboard/product-storyboard-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-image-gen-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-image-gen-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 6");
  console.log("Product Image Generation & Enhancement validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Image Generation Step 6");
    await workspace.updateProject(project.id, {
      productInformation: {
        name: "KWIZERA Steel Bottle",
        category: "Beverage",
        description: "Black insulated stainless steel portable bottle in a studio",
        materials: ["stainless steel"],
        colors: ["black"],
        features: ["insulated", "portable"],
        price: 39.99,
        currency: "USD",
      },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Drive product awareness and purchases", callToAction: "Shop now" },
      targetAudience: "Urban professionals",
      platform: "instagram",
    });
    await workspace.uploadImage(project.id, {
      fileName: "bottle-front-studio.png",
      mimeType: "image/png",
      dataBase64: Buffer.alloc(2048, 7).toString("base64"),
    });
    await workspace.uploadImage(project.id, {
      fileName: "bottle-detail-studio.png",
      mimeType: "image/png",
      dataBase64: Buffer.alloc(2048, 9).toString("base64"),
    });

    const images = new ImageIntelligenceManager();
    await images.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, workspace });
    const products = new ProductIntelligenceManager();
    await products.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, workspace });
    products.attachImageIntelligence(images);
    const assets = new ProductAssetPreparationManager();
    await assets.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, workspace, products, images });
    const scenes = new ProductScenePlanningManager();
    await scenes.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, workspace, products, assets });
    const storyboards = new ProductStoryboardManager();
    await storyboards.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
      scenes,
    });
    const orchestration = new ProductPromptOrchestrationManager();
    await orchestration.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
      scenes,
      storyboards,
    });
    const generation = new ProductImageGenerationManager();
    await generation.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
      scenes,
      storyboards,
      orchestration,
    });

    let health = await generation.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await generation.repair(project.id);
      repaired.push(...health.repaired);
    }

    const result = await generation.generateProductSceneImages(project.id);
    const explained = await generation.explainGeneration(project.id);
    const awareness = generation.getAiMeProductImageGenerationAwareness();
    const firstPath = result.images[0]
      ? path.join(storageRoot, "product-image-generation-runtime", result.images[0].relativePath)
      : "";

    results.productPreservation = {
      passed: result.quality.productPreservationScore >= 70
        && result.originalsUnmodified
        && result.images.every((image) => image.productPreserved && image.originalUnmodified),
      detail: `preservation=${result.quality.productPreservationScore}`,
    };
    results.backgroundGeneration = {
      passed: result.quality.backgroundScore >= 70
        && result.images.every((image) => Boolean(image.backgroundStyle && image.backgroundWhy)),
      detail: `background=${result.quality.backgroundScore}; styles=${[...new Set(result.images.map((image) => image.backgroundStyle))].join(",")}`,
    };
    results.imageEnhancement = {
      passed: result.quality.enhancementScore >= 70
        && result.images.every((image) => image.enhancement.sharpness >= 70 && image.enhancement.edgeQuality >= 70),
      detail: `enhancement=${result.quality.enhancementScore}`,
    };
    results.sceneConsistency = {
      passed: result.quality.sceneConsistencyScore >= 70
        && result.images.every((image) => image.productName === result.consistency.productName),
      detail: `consistency=${result.quality.sceneConsistencyScore}`,
    };
    results.imageQuality = {
      passed: result.quality.imageQualityScore >= 70 && result.quality.overall >= 70
        && Boolean(firstPath && fs.existsSync(firstPath) && fs.statSync(firstPath).size > 100),
      detail: `quality=${result.quality.imageQualityScore}; overall=${result.quality.overall}; fileBytes=${firstPath && fs.existsSync(firstPath) ? fs.statSync(firstPath).size : 0}`,
    };
    results.productAccuracy = {
      passed: result.quality.productAccuracyScore >= 70
        && result.images.every((image) => image.quality.productAccuracy >= 70),
      detail: `accuracy=${result.quality.productAccuracyScore}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canExplainGeneratedImages
        && awareness.canExplainBackgroundSelection
        && awareness.canExplainLightingDecisions
        && awareness.videoGenerationDeferred
        && explained.imageExplanations.length > 0
        && explained.backgroundExplanations.length > 0
        && explained.lightingExplanations.length > 0,
      detail: `imagesExplained=${explained.imageExplanations.length}`,
    };
    results.noVideoGen = {
      passed: result.videoGenerationDeferred && result.creativePipelineStep === 6,
      detail: `step=${result.creativePipelineStep}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await generation.runHealthCheck(project.id)).healthy,
      detail: `healthy=${health.healthy}; repaired=${repaired.join(",") || "none"}`,
    };

    const failed = Object.entries(results).filter(([, value]) => !value.passed);
    console.log("Checks:");
    for (const [name, value] of Object.entries(results)) {
      console.log(`- ${value.passed ? "PASS" : "FAIL"} ${name}: ${value.detail}`);
    }
    console.log("---");
    console.log(`Repaired: ${repaired.join(", ") || "none"}`);
    console.log(`Overall: ${failed.length === 0 ? "PASS" : "FAIL"} (${Object.keys(results).length - failed.length}/${Object.keys(results).length})`);

    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
    if (failed.length) process.exitCode = 1;
  } catch (error) {
    console.error("Validation failed:", error);
    process.exitCode = 1;
  }
}

void main();
