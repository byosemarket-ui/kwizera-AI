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
import { ProductScenePlanningManager } from "../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../ai/product-storyboard/product-storyboard-manager.js";
import { ProductVideoGenerationManager } from "../ai/product-video-generation/product-video-generation-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-audio-gen-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-audio-gen-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 8");
  console.log("Professional Audio, Voice & Music Generation validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Audio Generation Step 8");
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

    let health = await audioGen.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await audioGen.repair(project.id);
      repaired.push(...health.repaired);
    }

    const result = await audioGen.generateProductAudio(project.id);
    const explained = await audioGen.explainGeneration(project.id);
    const awareness = audioGen.getAiMeProductAudioGenerationAwareness();
    const mixAsset = result.assets.find((asset) => asset.kind === "mix");
    const mixPath = mixAsset
      ? path.join(storageRoot, "product-audio-generation-runtime", mixAsset.relativePath)
      : "";

    results.voiceGeneration = {
      passed: result.quality.voiceQualityScore >= 70 && Boolean(result.voice.persona && result.voice.language),
      detail: `persona=${result.voice.persona}; lang=${result.voice.language}; score=${result.quality.voiceQualityScore}`,
    };
    results.narration = {
      passed: result.quality.narrationQualityScore >= 70
        && result.narrationCues.length >= 4
        && result.narrationCues.every((cue) => cue.text.trim().length >= 8),
      detail: `cues=${result.narrationCues.length}; score=${result.quality.narrationQualityScore}`,
    };
    results.music = {
      passed: result.quality.musicQualityScore >= 70
        && result.music.licensedOrGenerated === "generated-offline"
        && result.copyrightSafe,
      detail: `style=${result.music.style}; score=${result.quality.musicQualityScore}`,
    };
    results.soundEffects = {
      passed: result.quality.soundEffectsScore >= 70 && result.soundEffects.length >= 3,
      detail: `fx=${result.soundEffects.length}; score=${result.quality.soundEffectsScore}`,
    };
    results.audioMixing = {
      passed: result.quality.mixBalanceScore >= 70
        && result.mix.musicBelowNarration
        && result.mix.musicVolume < result.mix.voiceVolume
        && Boolean(mixPath && fs.existsSync(mixPath) && fs.statSync(mixPath).size > 1000),
      detail: `voice=${result.mix.voiceVolume}; music=${result.mix.musicVolume}; mixBytes=${mixPath && fs.existsSync(mixPath) ? fs.statSync(mixPath).size : 0}`,
    };
    results.synchronization = {
      passed: result.quality.synchronizationScore >= 70 && result.sync.problems.length === 0,
      detail: `sync=${result.quality.synchronizationScore}; problems=${result.sync.problems.length}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canExplainVoiceSelection
        && awareness.canExplainMusicSelection
        && awareness.canExplainSoundEffects
        && awareness.canDetectAudioQualityProblems
        && awareness.renderingDeferred
        && Boolean(explained.voiceExplanation && explained.musicExplanation),
      detail: `effectsExplained=${explained.effectExplanations.length}`,
    };
    results.noRendering = {
      passed: result.renderingDeferred && result.creativePipelineStep === 8,
      detail: `step=${result.creativePipelineStep}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await audioGen.runHealthCheck(project.id)).healthy,
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
