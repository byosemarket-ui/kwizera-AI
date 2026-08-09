import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductAudioGenerationManager } from "../ai/product-audio-generation/product-audio-generation-manager.js";
import { ProductImageGenerationManager } from "../ai/product-image-generation/product-image-generation-manager.js";
import { ProductIntelligenceManager } from "../ai/product-intelligence/product-intelligence-manager.js";
import { ProductPromptOrchestrationManager } from "../ai/product-prompt-orchestration/product-prompt-orchestration-manager.js";
import { ProductRenderingExportManager } from "../ai/product-rendering-export/product-rendering-export-manager.js";
import { ProductScenePlanningManager } from "../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../ai/product-storyboard/product-storyboard-manager.js";
import { ProductVideoGenerationManager } from "../ai/product-video-generation/product-video-generation-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-render-export-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-render-export-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 9");
  console.log("Professional Rendering, Export & Delivery validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Rendering Export Step 9");
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
    const audioGen = new ProductAudioGenerationManager();
    await audioGen.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
      scenes,
      storyboards,
      orchestration,
      videos: videoGen,
    });
    const rendering = new ProductRenderingExportManager();
    await rendering.initialize(storageRoot, {
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

    let health = await rendering.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await rendering.repair(project.id);
      repaired.push(...health.repaired);
    }

    const result = await rendering.renderAndPackage(project.id);
    const explained = await rendering.explainRender(project.id);
    const awareness = rendering.getAiMeProductRenderingExportAwareness();
    const finalPath = path.join(storageRoot, "product-rendering-export-runtime", result.artifacts.finalVideoRelativePath);
    const mixPath = path.join(storageRoot, "product-rendering-export-runtime", result.artifacts.audioRelativePath);
    const manifestPath = path.join(storageRoot, "product-rendering-export-runtime", result.artifacts.projectManifestRelativePath);
    const subsPath = path.join(storageRoot, "product-rendering-export-runtime", result.artifacts.subtitlesRelativePath);

    results.rendering = {
      passed: result.quality.renderingScore >= 70 && fs.existsSync(finalPath) && fs.readFileSync(finalPath, "utf8").includes("<svg"),
      detail: `score=${result.quality.renderingScore}; version=${result.version}`,
    };
    results.export = {
      passed: result.quality.exportScore >= 70
        && fs.existsSync(manifestPath)
        && fs.existsSync(path.join(storageRoot, "product-rendering-export-runtime", result.artifacts.exportMetadataRelativePath)),
      detail: `score=${result.quality.exportScore}; format=${result.settings.format}`,
    };
    results.audioSynchronization = {
      passed: result.quality.audioSyncScore >= 70 && fs.existsSync(mixPath) && fs.readFileSync(mixPath).subarray(0, 4).toString("ascii") === "RIFF",
      detail: `score=${result.quality.audioSyncScore}`,
    };
    results.subtitleSynchronization = {
      passed: result.quality.subtitleAccuracyScore >= 70
        && fs.existsSync(subsPath)
        && fs.readFileSync(subsPath, "utf8").startsWith("WEBVTT"),
      detail: `score=${result.quality.subtitleAccuracyScore}`,
    };
    results.fileIntegrity = {
      passed: result.quality.exportIntegrityScore >= 70
        && result.originalsUnmodified
        && fs.existsSync(path.join(storageRoot, "product-rendering-export-runtime", result.artifacts.renderReportRelativePath)),
      detail: `integrity=${result.quality.exportIntegrityScore}`,
    };
    results.platformOptimization = {
      passed: result.quality.platformOptimizationScore >= 70 && result.platforms.length >= 7,
      detail: `platforms=${result.platforms.length}; score=${result.quality.platformOptimizationScore}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canExplainRenderingSettings
        && awareness.canCompareExportPresets
        && awareness.canRerenderFromHistory
        && awareness.certificationDeferred
        && Boolean(explained.settingsExplanation)
        && explained.platformComparisons.length >= 7,
      detail: `presets=${explained.platformComparisons.length}`,
    };
    results.noCertification = {
      passed: result.certificationDeferred && result.creativePipelineStep === 9,
      detail: `step=${result.creativePipelineStep}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await rendering.runHealthCheck(project.id)).healthy,
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
