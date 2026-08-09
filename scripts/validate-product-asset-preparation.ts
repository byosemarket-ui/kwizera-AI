import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../ai/image-intelligence/image-intelligence-manager.js";
import { ProductAssetPreparationManager } from "../ai/product-asset-preparation/product-asset-preparation-manager.js";
import { ProductIntelligenceManager } from "../ai/product-intelligence/product-intelligence-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-asset-prep-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-asset-prep-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 2");
  console.log("Background Removal & Product Asset Preparation validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Asset Prep Step 2");
    await workspace.updateProject(project.id, {
      productInformation: {
        name: "KWIZERA Steel Oil Bottle",
        category: "Beverage",
        description: "Black insulated stainless steel portable bottle with studio background",
        materials: ["stainless steel"],
        colors: ["black"],
        features: ["insulated"],
      },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Awareness" },
      targetAudience: "Urban professionals",
    });
    await workspace.uploadImage(project.id, {
      fileName: "bottle-front-studio.png",
      mimeType: "image/png",
      dataBase64: Buffer.alloc(2048, 7).toString("base64"),
    });
    await workspace.uploadImage(project.id, {
      fileName: "bottle-side-studio.png",
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

    let health = await assets.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await assets.repair(project.id);
      repaired.push(...health.repaired);
    }

    const prepared = await assets.prepareProductAssets(project.id);
    const again = await assets.prepareProductAssets(project.id);
    const explained = await assets.explainAssetQuality(project.id);
    const awareness = assets.getAiMeProductAssetAwareness();
    const library = await assets.getLibrary(project.id);

    const originalPaths = await Promise.all(
      (await workspace.getProject(project.id))!.productImages.map((image) => workspace.getOriginalImagePath(project.id, image.id)),
    );
    const originalsExist = originalPaths.every((item) => item && fs.existsSync(item));

    results.productDetection = {
      passed: prepared.assets.every((asset) => asset.removalPlan.productDetected),
      detail: `assets=${prepared.assets.length}`,
    };
    results.backgroundRemoval = {
      passed: prepared.qualitySummary.backgroundRemovalPassRate >= 0.8,
      detail: `passRate=${prepared.qualitySummary.backgroundRemovalPassRate}`,
    };
    results.edgeQuality = {
      passed: prepared.qualitySummary.edgePassRate >= 0.8,
      detail: `passRate=${prepared.qualitySummary.edgePassRate}`,
    };
    results.transparency = {
      passed: prepared.assets.every((asset) => asset.transparency && asset.quality.transparencyCorrect),
      detail: `transparent=${prepared.assets.filter((asset) => asset.transparency).length}`,
    };
    results.assetLibrary = {
      passed: library.length >= 2 && library.every((asset) => asset.assetId && asset.boundingBox.width > 0),
      detail: `library=${library.length}; version=${library[0]?.version}`,
    };
    results.duplicateProtection = {
      passed: again.assets.length === prepared.assets.length
        && new Set(library.map((asset) => asset.fingerprint)).size === library.length,
      detail: `first=${prepared.assets.length}; second=${again.assets.length}; uniqueFp=${new Set(library.map((a) => a.fingerprint)).size}`,
    };
    results.originalsPreserved = {
      passed: prepared.originalsUnmodified && originalsExist,
      detail: `originalsExist=${originalsExist}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canUseProcessedAssets
        && awareness.canDetectMissingAngles
        && awareness.canExplainAssetQuality
        && awareness.scenePlanningDeferred
        && explained.assetCount >= 2,
      detail: `missingViews=${explained.missingViews.length}; ready=${explained.readyForScenePlanning}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await assets.runHealthCheck(project.id)).healthy,
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
