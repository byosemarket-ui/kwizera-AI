import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../ai/product-intelligence/product-intelligence-manager.js";
import { ProductPromptOrchestrationManager } from "../ai/product-prompt-orchestration/product-prompt-orchestration-manager.js";
import { ProductScenePlanningManager } from "../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../ai/product-storyboard/product-storyboard-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-prompt-orch-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-prompt-orch-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 5");
  console.log("Prompt Intelligence & AI Model Orchestration validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Prompt Orchestration Step 5");
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

    let health = await orchestration.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await orchestration.repair(project.id);
      repaired.push(...health.repaired);
    }

    const result = await orchestration.orchestratePromptsAndModels(project.id);
    const explained = await orchestration.explainOrchestration(project.id);
    const awareness = orchestration.getAiMeProductPromptOrchestrationAwareness();

    results.promptGeneration = {
      passed: result.scenePromptSets.length >= 4
        && result.scenePromptSets.every((set) =>
          ["image", "video", "animation", "camera", "lighting", "background", "audio", "voice", "subtitle", "rendering"]
            .every((kind) => Boolean(set.prompts[kind as keyof typeof set.prompts])),
        ),
      detail: `scenes=${result.scenePromptSets.length}; score=${result.quality.promptGenerationScore}`,
    };
    results.promptQuality = {
      passed: result.quality.promptQualityScore >= 70
        && result.scenePromptSets.every((set) => set.optimizationNotes.length >= 5),
      detail: `quality=${result.quality.promptQualityScore}`,
    };
    results.promptConsistency = {
      passed: result.quality.promptConsistencyScore >= 70 && result.promptConflicts.length === 0,
      detail: `consistency=${result.quality.promptConsistencyScore}; conflicts=${result.promptConflicts.length}`,
    };
    results.modelSelection = {
      passed: result.quality.modelSelectionScore >= 70
        && result.modelSelections.every((item) => item.bestModelId && item.backupModelId && item.swappable),
      detail: `models=${result.modelSelections.length}`,
    };
    results.executionPlan = {
      passed: result.quality.executionPlanScore >= 70
        && result.executionPlan.tasks.length > 0
        && result.executionPlan.sceneExecutionOrder.length >= 4,
      detail: `tasks=${result.executionPlan.tasks.length}; scenes=${result.executionPlan.sceneExecutionOrder.length}`,
    };
    results.orchestrationLogic = {
      passed: result.quality.orchestrationScore >= 70 && result.orchestrationFailures.length === 0,
      detail: `orchestration=${result.quality.orchestrationScore}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canExplainModelSelection
        && awareness.canExplainPrompts
        && awareness.imageGenerationDeferred
        && explained.modelExplanations.length > 0
        && explained.promptExplanations.length > 0,
      detail: `modelsExplained=${explained.modelExplanations.length}; promptsExplained=${explained.promptExplanations.length}`,
    };
    results.noImageVideoGen = {
      passed: result.imageGenerationDeferred && result.videoGenerationDeferred && result.creativePipelineStep === 5,
      detail: `step=${result.creativePipelineStep}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await orchestration.runHealthCheck(project.id)).healthy,
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
