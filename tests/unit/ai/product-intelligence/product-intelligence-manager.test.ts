import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("ProductIntelligenceManager", () => {
  it("groups uploaded views into a durable product profile with classification, brand, materials, quality, and relationships", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-intelligence-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("Bottle Launch");
    await workspace.updateProject(project.id, {
      productInformation: {
        name: "KWIZERA Steel Bottle",
        category: "Beverage",
        description: "Black insulated stainless steel portable bottle",
        sku: "KB-01",
      },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Awareness" },
      targetAudience: "Urban professionals",
    });
    await workspace.uploadImage(project.id, {
      fileName: "black-steel-bottle-front.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
      allowDuplicateContent: true,
    });
    await workspace.uploadImage(project.id, {
      fileName: "black-steel-bottle-side.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
      allowDuplicateContent: true,
    });
    const manager = new ProductIntelligenceManager();
    await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const profile = await manager.analyze(project.id);
    expect(profile.viewCount).toBe(2);
    expect(profile.category).toBe("Beverage container");
    expect(profile.brand).toBe("KWIZERA");
    expect(profile.materials).toContain("stainless steel");
    expect(profile.colours).toContain("black");
    expect(profile.shapes).toContain("cylindrical");
    expect(profile.quality.score).toBeGreaterThan(80);
    expect(profile.relationships).toHaveLength(3);
    expect(profile.originalImagesUnmodified).toBe(true);
    expect(profile.multiView.views.some((view) => view.role === "front")).toBe(true);
    expect((await manager.analyze(project.id)).cached).toBe(true);
    const restored = new ProductIntelligenceManager();
    await restored.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const dashboard = await restored.getDashboard(project.id);
    expect(dashboard.profiles).toHaveLength(1);
    expect(dashboard.analytics.multiViewProfiles).toBe(1);
  });

  it("builds Step 1 intelligence with image analysis, missing info, photo recommendations, and AI Me explain APIs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-intelligence-step1-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("Step1 Bottle");
    await workspace.updateProject(project.id, {
      productInformation: {
        name: "KWIZERA Steel Bottle",
        category: "Beverage",
        description: "Black insulated stainless steel portable bottle",
        features: ["insulated"],
        price: 39.99,
        currency: "USD",
      },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Awareness" },
      targetAudience: "Urban professionals",
    });
    await workspace.uploadImage(project.id, {
      fileName: "bottle-front.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
      allowDuplicateContent: true,
    });
    await workspace.uploadImage(project.id, {
      fileName: "bottle-front-copy.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
      allowDuplicateContent: true,
    });
    const images = new ImageIntelligenceManager();
    await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const manager = new ProductIntelligenceManager();
    await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    manager.attachImageIntelligence(images);
    const profile = await manager.analyzeProductIntelligence(project.id);
    expect(profile.imageAnalysis.duplicateImageIds.length).toBeGreaterThan(0);
    expect(profile.photoRecommendations.length).toBeGreaterThan(0);
    expect(profile.missingInformation.length).toBeGreaterThan(0);
    expect(profile.sellingPoints.length).toBeGreaterThan(0);
    const explained = await manager.explainProduct(project.id);
    expect(explained.characteristics.length).toBeGreaterThan(4);
    const awareness = manager.getAiMeProductIntelligenceAwareness();
    expect(awareness.canRecommendAdditionalPhotos).toBe(true);
    expect(awareness.backgroundRemovalDeferred).toBe(true);
    const health = await manager.runHealthCheck(project.id);
    expect(health.healthy).toBe(true);
  });
});
