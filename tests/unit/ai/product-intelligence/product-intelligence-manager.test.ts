import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });
describe("ProductIntelligenceManager", () => {
  it("groups uploaded views into a durable product profile with classification, brand, materials, quality, and relationships", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-product-intelligence-")); roots.push(root);
    const workspace = new CreativeWorkspaceManager(); await workspace.initialize(root);
    const project = await workspace.createProject("Bottle Launch"); await workspace.updateProject(project.id, { productInformation: { name: "KWIZERA Steel Bottle", category: "Beverage", description: "Black insulated stainless steel portable bottle", sku: "KB-01" }, brandInformation: { name: "KWIZERA" }, campaignInformation: { name: "Launch", objective: "Awareness" }, targetAudience: "Urban professionals" });
    await workspace.uploadImage(project.id, { fileName: "black-steel-bottle-front.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" }); await workspace.uploadImage(project.id, { fileName: "black-steel-bottle-side.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });
    const manager = new ProductIntelligenceManager(); await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace }); const profile = await manager.analyze(project.id);
    expect(profile.viewCount).toBe(2); expect(profile.category).toBe("Beverage container"); expect(profile.brand).toBe("KWIZERA"); expect(profile.materials).toContain("stainless steel"); expect(profile.colours).toContain("black"); expect(profile.shapes).toContain("cylindrical"); expect(profile.quality.score).toBeGreaterThan(80); expect(profile.relationships).toHaveLength(3); expect((await manager.analyze(project.id)).cached).toBe(true);
    const restored = new ProductIntelligenceManager(); await restored.initialize(root, { core: undefined as unknown as AiCoreManager, workspace }); const dashboard = await restored.getDashboard(project.id); expect(dashboard.profiles).toHaveLength(1); expect(dashboard.analytics.multiViewProfiles).toBe(1);
  });
});