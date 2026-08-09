import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../ai/product-intelligence/product-intelligence-manager.js";
import { ProductScenePlanningManager } from "../ai/product-scene-planning/product-scene-planning-manager.js";
import { ProductStoryboardManager } from "../ai/product-storyboard/product-storyboard-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-storyboard-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-storyboard-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 4");
  console.log("Storyboard & Marketing Script Generation validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Storyboard Step 4");
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
    await assets.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      images,
    });
    const scenes = new ProductScenePlanningManager();
    await scenes.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
    });
    const storyboards = new ProductStoryboardManager();
    await storyboards.initialize(storageRoot, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      assets,
      scenes,
    });

    let health = await storyboards.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await storyboards.repair(project.id);
      repaired.push(...health.repaired);
    }

    const board = await storyboards.generateStoryboardAndScript(project.id);
    const explained = await storyboards.explainStoryboard(project.id);
    const awareness = storyboards.getAiMeProductStoryboardAwareness();

    results.storyboardGeneration = {
      passed: board.totalScenes >= 4 && board.panels.every((panel) => panel.sceneDescription && panel.assetId),
      detail: `scenes=${board.totalScenes}; score=${board.quality.storyboardScore}`,
    };
    results.scriptGeneration = {
      passed:
        board.quality.scriptScore >= 70
        && Boolean(board.marketingScript.openingHook)
        && Boolean(board.marketingScript.callToAction)
        && Boolean(board.marketingScript.fullNarration),
      detail: `scriptScore=${board.quality.scriptScore}`,
    };
    results.sceneConsistency = {
      passed: board.quality.sceneConsistencyScore >= 70
        && board.panels.every((panel, index) => panel.sceneNumber === index + 1),
      detail: `consistency=${board.quality.sceneConsistencyScore}`,
    };
    results.marketingFlow = {
      passed: board.quality.marketingFlowScore >= 70
        && board.marketingBeatsPresent.includes("attention")
        && board.marketingBeatsPresent.includes("call-to-action"),
      detail: `flow=${board.quality.marketingFlowScore}; beats=${board.marketingBeatsPresent.join(",")}`,
    };
    results.productUsage = {
      passed: board.quality.productUsageScore >= 70 && board.panels.every((panel) => panel.assetId),
      detail: `usage=${board.quality.productUsageScore}`,
    };
    results.ctaPlacement = {
      passed: board.quality.ctaPlacementScore >= 70
        && board.panels.some((panel) => panel.ctaPlacement !== "none"),
      detail: `cta=${board.quality.ctaPlacementScore}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canExplainStoryboardDecisions
        && awareness.canExplainScriptDecisions
        && awareness.promptOrchestrationDeferred
        && explained.storyboardDecisions.length >= 4,
      detail: `decisions=${explained.storyboardDecisions.length}; ready=${explained.readyForPromptOrchestration}`,
    };
    results.noVideoPrompt = {
      passed: board.videoGenerationDeferred && board.promptOrchestrationDeferred && board.creativePipelineStep === 4,
      detail: `step=${board.creativePipelineStep}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await storyboards.runHealthCheck(project.id)).healthy,
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
