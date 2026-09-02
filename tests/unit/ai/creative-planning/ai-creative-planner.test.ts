import { describe, expect, it } from "vitest";
import {
  generateCreativeScenes,
  setCreativeReasoningProvider,
  type CreativeReasoningProvider,
} from "../../../../ai/creative-planning/ai-creative-planner.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

function projectFixture(): CreativeProject {
  const now = new Date().toISOString();
  return {
    id: "project-1",
    name: "Oxford",
    createdAt: now,
    modifiedAt: now,
    productImages: [
      { id: "asset-front", fileName: "front.png", mimeType: "image/png", sizeBytes: 24, uploadedAt: now, url: "/front.png" },
      { id: "asset-side", fileName: "left.png", mimeType: "image/png", sizeBytes: 24, uploadedAt: now, url: "/left.png" },
    ],
    productInformation: { name: "Oxford", category: "Shoes", description: "Brown shoe" },
    brandInformation: { name: "KWIZERA" },
    campaignInformation: { name: "Launch", objective: "Product Showcase", callToAction: "Shop now" },
    targetAudience: "Everyone",
    language: "Kinyarwanda",
    platform: "tiktok",
    workspaceSettings: {},
  };
}

describe("AI creative planner fallback", () => {
  it("falls back to deterministic planning when AI provider is unavailable", async () => {
    setCreativeReasoningProvider(null);
    const result = await generateCreativeScenes({
      project: projectFixture(),
      assets: [],
      videoSettings: {
        productionMode: "CLASSIC_SHOWCASE",
        platform: "tiktok",
        durationSeconds: 30,
        language: "Kinyarwanda",
        objective: "Product Showcase",
      },
      canonical: {
        version: 1,
        productId: "project-1",
        projectId: "project-1",
        projectName: "Oxford",
        identity: { name: "Oxford", brand: "KWIZERA", category: "shoes", productType: "shoe" },
        originalAssets: [
          {
            assetId: "asset-front",
            productId: "project-1",
            originalFilename: "front.png",
            storedFileName: "front.png",
            originalRelativePath: "projects/project-1/assets/front.png",
            productionUrl: "/front.png",
            mimeType: "image/png",
            fileSize: 24,
            width: 800,
            height: 800,
            uploadedAt: new Date().toISOString(),
            processingStatus: "READY",
            fileAccessible: true,
          },
          {
            assetId: "asset-side",
            productId: "project-1",
            originalFilename: "left.png",
            storedFileName: "left.png",
            originalRelativePath: "projects/project-1/assets/left.png",
            productionUrl: "/left.png",
            mimeType: "image/png",
            fileSize: 24,
            width: 800,
            height: 800,
            uploadedAt: new Date().toISOString(),
            processingStatus: "READY",
            fileAccessible: true,
          },
        ],
        processedAssets: [],
        productionAssets: [],
        finalOutputs: [],
        productViews: [
          { assetId: "asset-front", view: "front", confidence: 1, source: "user" },
          { assetId: "asset-side", view: "left", confidence: 0.8, source: "ai" },
        ],
        assetMap: {},
        visualAnalysis: { features: [], materials: [], colours: [], analyzedAt: null },
        productFeatures: [],
        marketingData: { sellingPoints: [], targetAudience: "", keywords: [] },
        productionData: {
          readiness: "READY",
          readyReason: "ok",
          analysisCompleted: true,
          requiredAssetsPresent: true,
          pathsValid: true,
        },
        intelligence: null,
        updatedAt: new Date().toISOString(),
      },
    });
    expect(result.source).toBe("deterministic");
    expect(result.scenes.length).toBeGreaterThan(0);
    expect(result.scenes.every((scene) => scene.assetId)).toBe(true);
  });

  it("uses AI output only when validated", async () => {
    const provider: CreativeReasoningProvider = {
      id: "test",
      async isAvailable() { return true; },
      async planCreativeScenes() {
        return { scenes: [{ id: "ai-1", purpose: "HOOK", assetId: "asset-front", duration: 3 }] };
      },
    };
    setCreativeReasoningProvider(provider);
    const result = await generateCreativeScenes({
      project: projectFixture(),
      assets: [],
      videoSettings: {
        productionMode: "AI_PRODUCT_MOTION",
        platform: "tiktok",
        durationSeconds: 15,
        language: "English",
        objective: "Product Showcase",
      },
      canonical: {
        version: 1,
        productId: "project-1",
        projectId: "project-1",
        projectName: "Oxford",
        identity: { name: "Oxford", brand: "KWIZERA", category: "shoes", productType: "shoe" },
        originalAssets: [{
          assetId: "asset-front",
          productId: "project-1",
          originalFilename: "front.png",
          storedFileName: "front.png",
          originalRelativePath: "projects/project-1/assets/front.png",
          productionUrl: "/front.png",
          mimeType: "image/png",
          fileSize: 24,
          width: 800,
          height: 800,
          uploadedAt: new Date().toISOString(),
          processingStatus: "READY",
          fileAccessible: true,
        }],
        processedAssets: [],
        productionAssets: [],
        finalOutputs: [],
        productViews: [{ assetId: "asset-front", view: "front", confidence: 1, source: "user" }],
        assetMap: {},
        visualAnalysis: { features: [], materials: [], colours: [], analyzedAt: null },
        productFeatures: [],
        marketingData: { sellingPoints: [], targetAudience: "", keywords: [] },
        productionData: {
          readiness: "READY",
          readyReason: "ok",
          analysisCompleted: true,
          requiredAssetsPresent: true,
          pathsValid: true,
        },
        intelligence: null,
        updatedAt: new Date().toISOString(),
      },
    });
    expect(result.source).toBe("ai");
    expect(result.scenes[0]?.purpose).toBe("HOOK");
    setCreativeReasoningProvider(null);
  });
});
