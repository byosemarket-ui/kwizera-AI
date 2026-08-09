import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../ai/product-intelligence/product-intelligence-manager.js";
import { ProductScenePlanningManager } from "../ai/product-scene-planning/product-scene-planning-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-scene-planning-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-scene-planning-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 3");
  console.log("Product Scene Planning Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Scene Planning Step 3");
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

    let health = await scenes.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await scenes.repair(project.id);
      repaired.push(...health.repaired);
    }

    const plan = await scenes.planProductScenes(project.id);
    const explained = await scenes.explainScenes(project.id);
    const awareness = scenes.getAiMeProductScenePlanningAwareness();
    const order = await scenes.recommendSceneOrder(project.id);

    results.sceneCompleteness = {
      passed: plan.sceneCount >= 4 && plan.scenes.every((scene) => scene.sceneId && scene.objective),
      detail: `scenes=${plan.sceneCount}; types=${plan.scenes.map((scene) => scene.sceneType).join(",")}`,
    };
    results.sceneOrder = {
      passed: plan.quality.sceneOrderScore >= 70 && plan.scenes.every((scene, index) => scene.order === index + 1),
      detail: `orderScore=${plan.quality.sceneOrderScore}; sequence=${plan.sequence.join(" | ")}`,
    };
    results.marketingFlow = {
      passed: plan.quality.marketingFlowScore >= 70
        && plan.scenes.some((scene) => scene.marketingFlowStage === "attention")
        && plan.scenes.some((scene) => scene.marketingFlowStage === "product-reveal")
        && plan.scenes.some((scene) => scene.marketingFlowStage === "call-to-action"),
      detail: `flowScore=${plan.quality.marketingFlowScore}; weak=${plan.weakFlowNotes.length}`,
    };
    results.productUsage = {
      passed: plan.quality.productUsageScore >= 70
        && plan.scenes.every((scene) => scene.productUtilization.length > 0)
        && plan.productUsageCoverage.some((item) => item.sceneIds.length > 0),
      detail: `usageScore=${plan.quality.productUsageScore}; coveredAssets=${plan.productUsageCoverage.filter((item) => item.sceneIds.length).length}`,
    };
    results.cameraPlanning = {
      passed: plan.quality.cameraPlanningScore >= 70
        && plan.scenes.every((scene) => scene.cameraAngle && scene.cameraMovement),
      detail: `cameraScore=${plan.quality.cameraPlanningScore}`,
    };
    results.lightingPlanning = {
      passed: plan.quality.lightingPlanningScore >= 70
        && plan.scenes.every((scene) => scene.lightingStyle && scene.backgroundStyle),
      detail: `lightingScore=${plan.quality.lightingPlanningScore}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canExplainScenes
        && awareness.canRecommendSceneOrder
        && awareness.canDetectMissingScenes
        && awareness.storyboardGenerationDeferred
        && explained.sceneExplanations.length >= 4
        && order.length >= 4,
      detail: `explanations=${explained.sceneExplanations.length}; order=${order.length}; ready=${explained.readyForStoryboard}`,
    };
    results.noStoryboardVideo = {
      passed: plan.storyboardGenerationDeferred && plan.videoGenerationDeferred && plan.creativePipelineStep === 3,
      detail: `step=${plan.creativePipelineStep}; storyboardDeferred=${plan.storyboardGenerationDeferred}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await scenes.runHealthCheck(project.id)).healthy,
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
