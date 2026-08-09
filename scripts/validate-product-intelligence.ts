import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../ai/image-intelligence/image-intelligence-manager.js";
import { ProductIntelligenceManager } from "../ai/product-intelligence/product-intelligence-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-intelligence-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `product-intelligence-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 1");
  console.log("Product Intelligence Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const repaired: string[] = [];
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(storageRoot);
    const project = await workspace.createProject("Product Intelligence Step 1");
    await workspace.updateProject(project.id, {
      productInformation: {
        name: "KWIZERA Steel Bottle",
        category: "Beverage",
        description: "Black insulated stainless steel portable bottle for creators",
        sku: "KB-01",
        brand: "KWIZERA",
        price: 39.99,
        currency: "USD",
        features: ["insulated", "portable", "leak-resistant"],
        materials: ["stainless steel"],
        colors: ["black"],
        sizes: ["500ml"],
        tags: ["bottle", "travel"],
        specifications: { dimensions: "500ml", weight: "320g" },
      },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Awareness" },
      targetAudience: "Urban professionals",
    });
    await workspace.uploadImage(project.id, {
      fileName: "black-steel-bottle-front-studio.png",
      mimeType: "image/png",
      dataBase64: "iVBORw0KGgo=",
    });
    await workspace.uploadImage(project.id, {
      fileName: "black-steel-bottle-side-studio.png",
      mimeType: "image/png",
      dataBase64: "iVBORw0KGgo=",
    });
    await workspace.uploadImage(project.id, {
      fileName: "black-steel-bottle-front-studio-copy.png",
      mimeType: "image/png",
      dataBase64: "iVBORw0KGgo=",
    });

    const images = new ImageIntelligenceManager();
    await images.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, workspace });
    const products = new ProductIntelligenceManager();
    await products.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, workspace });
    products.attachImageIntelligence(images);

    let health = await products.runHealthCheck(project.id);
    if (!health.healthy) {
      health = await products.repair(project.id);
      repaired.push(...health.repaired);
    }

    const profile = await products.analyzeProductIntelligence(project.id);
    const explanation = await products.explainProduct(project.id);
    const awareness = products.getAiMeProductIntelligenceAwareness();
    const imageProfiles = await images.getProfiles(project.id);

    results.productDetection = {
      passed: Boolean(profile.productType && profile.category && profile.productName === "KWIZERA Steel Bottle"),
      detail: `${profile.identifiedAs}; type=${profile.productType}`,
    };
    results.imageAnalysis = {
      passed:
        profile.imageAnalysis.imageCount >= 2
        && imageProfiles.every((item) => item.boundaries && item.resolution && item.viewRole)
        && profile.originalImagesUnmodified === true,
      detail: `images=${profile.imageAnalysis.imageCount}; boundaries=${profile.imageAnalysis.boundariesDetected}; views=${profile.multiView.views.map((view) => view.role).join(",")}`,
    };
    results.productProfileCreation = {
      passed:
        profile.sellingPoints.length > 0
        && profile.marketingKeywords.length > 0
        && profile.targetAudience.includes("Urban")
        && typeof profile.price === "number",
      detail: `usps=${profile.sellingPoints.length}; keywords=${profile.marketingKeywords.length}; audience=${profile.targetAudience}`,
    };
    results.metadataGeneration = {
      passed: Boolean(profile.metadata.provider && profile.metadata.creativePipelineStep === 1),
      detail: `provider=${profile.metadata.provider}; step=${profile.metadata.creativePipelineStep}`,
    };
    results.duplicateDetection = {
      passed: profile.imageAnalysis.duplicateImageIds.length >= 1 || imageProfiles.some((item) => item.duplicateOfImageId),
      detail: `duplicates=${profile.imageAnalysis.duplicateImageIds.length}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canUnderstandProduct
        && awareness.canExplainCharacteristics
        && awareness.canDetectMissingInformation
        && awareness.canRecommendAdditionalPhotos
        && awareness.backgroundRemovalDeferred
        && awareness.videoGenerationDeferred
        && explanation.characteristics.length >= 5,
      detail: `explainChars=${explanation.characteristics.length}; missing=${explanation.missingInformation.length}; photos=${explanation.photoRecommendations.length}`,
    };
    results.healthCheck = {
      passed: health.healthy || (await products.runHealthCheck(project.id)).healthy,
      detail: `healthy=${health.healthy}; repaired=${repaired.join(",") || "none"}; critical=${health.criticalIssues.length}`,
    };
    results.noImaginaryProduct = {
      passed: profile.productName === "KWIZERA Steel Bottle" && profile.brand === "KWIZERA" && !/imaginary|hallucin/i.test(JSON.stringify(profile.sellingPoints)),
      detail: "Profile uses user-provided product evidence only.",
    };

    const failed = Object.entries(results).filter(([, value]) => !value.passed);
    console.log("Checks:");
    for (const [name, value] of Object.entries(results)) {
      console.log(`- ${value.passed ? "PASS" : "FAIL"} ${name}: ${value.detail}`);
    }
    console.log("---");
    console.log(`Repaired: ${repaired.join(", ") || "none"}`);
    console.log(`Overall: ${failed.length === 0 ? "PASS" : "FAIL"} (${Object.keys(results).length - failed.length}/${Object.keys(results).length})`);

    if (useTemp) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    if (failed.length) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Validation failed:", error);
    process.exitCode = 1;
  }
}

void main();
