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
import { ProductVideoGenerationManager } from "../ai/product-video-generation/product-video-generation-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-video-gen-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-video-gen-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 7");
  console.log("Professional Product Video Generation validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Video Generation Step 7");
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
    const imageGen = new ProductImageGenerationManager();
    await imageGen.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
      scenes,
      storyboards,
      orchestration,
    });
    const videoGen = new ProductVideoGenerationManager();
    await videoGen.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
      scenes,
      storyboards,
      orchestration,
      images: imageGen,
    });

    let health = await videoGen.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await videoGen.repair(project.id);
      repaired.push(...health.repaired);
    }

    const result = await videoGen.generateProductSceneVideos(project.id);
    const explained = await videoGen.explainGeneration(project.id);
    const awareness = videoGen.getAiMeProductVideoGenerationAwareness();
    const firstPath = result.clips[0]
      ? path.join(storageRoot, "product-video-generation-runtime", result.clips[0].relativePath)
      : "";
    const assembledPath = path.join(storageRoot, "product-video-generation-runtime", result.assembledRelativePath);

    results.videoGeneration = {
      passed: result.quality.videoGenerationScore >= 70
        && result.clips.length >= 4
        && Boolean(firstPath && fs.existsSync(firstPath) && fs.readFileSync(firstPath, "utf8").includes("product preserved")),
      detail: `clips=${result.clips.length}; score=${result.quality.videoGenerationScore}; duration=${result.totalDurationSeconds}s`,
    };
    results.motionQuality = {
      passed: result.quality.motionQualityScore >= 70
        && result.clips.every((clip) => clip.quality.motionQuality >= 70),
      detail: `motion=${result.quality.motionQualityScore}`,
    };
    results.cameraExecution = {
      passed: result.quality.cameraQualityScore >= 70
        && result.clips.every((clip) => Boolean(clip.cameraMove && clip.cameraWhy)),
      detail: `camera=${result.quality.cameraQualityScore}; moves=${[...new Set(result.clips.map((clip) => clip.cameraMove))].join(",")}`,
    };
    results.productPreservation = {
      passed: result.quality.productPreservationScore >= 70
        && result.originalsUnmodified
        && result.clips.every((clip) => clip.productPreserved && clip.originalUnmodified),
      detail: `preservation=${result.quality.productPreservationScore}`,
    };
    results.visualConsistency = {
      passed: result.quality.visualConsistencyScore >= 70
        && result.clips.every((clip) => clip.productName === result.consistency.productName),
      detail: `consistency=${result.quality.visualConsistencyScore}`,
    };
    results.marketingFlow = {
      passed: result.quality.marketingFlowScore >= 70
        && result.marketingFlowPresent.includes("hook")
        && result.marketingFlowPresent.includes("call-to-action"),
      detail: `flow=${result.quality.marketingFlowScore}; present=${result.marketingFlowPresent.join(",")}; missing=${result.missingMarketingBeats.length}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canExplainScenes
        && awareness.canExplainCameraMovements
        && awareness.canExplainVisualEffects
        && awareness.canExplainMarketingDecisions
        && awareness.audioVoiceDeferred
        && explained.sceneExplanations.length > 0
        && explained.cameraExplanations.length > 0,
      detail: `scenesExplained=${explained.sceneExplanations.length}`,
    };
    results.noAudioVoice = {
      passed: result.audioVoiceDeferred && result.creativePipelineStep === 7
        && Boolean(assembledPath && fs.existsSync(assembledPath)),
      detail: `step=${result.creativePipelineStep}; assembled=${fs.existsSync(assembledPath)}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await videoGen.runHealthCheck(project.id)).healthy,
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
