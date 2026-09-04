import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });
describe("ImageIntelligenceManager", () => {
  it("builds persisted per-image profiles with quality, background, view, object, scene, and enhancement intelligence", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-image-intelligence-")); roots.push(root);
    const workspace = new CreativeWorkspaceManager(); await workspace.initialize(root); const project = await workspace.createProject("Bottle Launch"); await workspace.updateProject(project.id, { productInformation: { name: "Studio Bottle", category: "Beverage", description: "Black insulated steel bottle in a studio" }, brandInformation: { name: "KWIZERA" }, campaignInformation: { name: "Launch", objective: "Awareness" }, targetAudience: "Urban professionals" });
    await workspace.uploadImage(project.id, { fileName: "black-steel-bottle-front-studio.png", mimeType: "image/png", dataBase64: PNG_1X1, allowDuplicateContent: true });
    await workspace.uploadImage(project.id, { fileName: "black-steel-bottle-side-studio.png", mimeType: "image/png", dataBase64: PNG_1X1, allowDuplicateContent: true });
    const manager = new ImageIntelligenceManager(); await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace }); const profiles = await manager.analyzeProject(project.id);
    expect(profiles).toHaveLength(2);
    expect(profiles[0].background.type).toBe("White Studio");
    expect(profiles[0].background.complexity).toBe("low");
    expect(profiles[0].quality.classification).toBeTruthy();
    expect(profiles[0].colors?.length).toBeGreaterThan(0);
    expect(profiles[0].visibility?.percent).toBeGreaterThan(0);
    expect(profiles[0].cameraAngle).toBe("front product view");
    expect(profiles[0].objects.some((object) => object.label === "bottle")).toBe(true);
    expect(profiles[0].enhancements.length).toBeGreaterThan(0);
    expect(profiles[0].boundaries.detected).toBe(true);
    expect(profiles[0].resolution.tier).toBeTruthy();
    expect(profiles[0].viewRole).toBe("front");
    expect((await manager.analyzeProject(project.id))[0].cached).toBe(true);
    const restored = new ImageIntelligenceManager(); await restored.initialize(root, { core: undefined as unknown as AiCoreManager, workspace }); const dashboard = await restored.getDashboard(project.id); expect(dashboard.profiles).toHaveLength(2); expect(dashboard.analytics.analyzedImages).toBe(2);
  });

  it("detects duplicate uploads without modifying original image bytes", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-image-intelligence-dup-")); roots.push(root);
    const workspace = new CreativeWorkspaceManager(); await workspace.initialize(root); const project = await workspace.createProject("Dup Check"); await workspace.updateProject(project.id, { productInformation: { name: "Studio Bottle", category: "Beverage", description: "Black insulated steel bottle in a studio" }, brandInformation: { name: "KWIZERA" }, campaignInformation: { name: "Launch", objective: "Awareness" }, targetAudience: "Urban professionals" });
    await workspace.uploadImage(project.id, { fileName: "bottle-front.png", mimeType: "image/png", dataBase64: PNG_1X1, allowDuplicateContent: true });
    await workspace.uploadImage(project.id, { fileName: "bottle-front-copy.png", mimeType: "image/png", dataBase64: PNG_1X1, allowDuplicateContent: true });
    const manager = new ImageIntelligenceManager(); await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const profiles = await manager.analyzeProject(project.id);
    expect(profiles.some((profile) => profile.duplicateOfImageId)).toBe(true);
    expect(profiles.every((profile) => profile.metadata.originalImageUnmodified === 1)).toBe(true);
  });
});