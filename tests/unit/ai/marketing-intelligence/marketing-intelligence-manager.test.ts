import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { MarketingIntelligenceManager } from "../../../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("MarketingIntelligenceManager", () => {
  it("creates a persisted strategy profile using product and image intelligence, platform guidance, CTAs, selling points, and recommendations", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-marketing-intelligence-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("Bottle Launch");
    await workspace.updateProject(project.id, {
      productInformation: { name: "KWIZERA Steel Bottle", category: "Beverage", description: "Black insulated stainless steel portable bottle" },
      brandInformation: { name: "KWIZERA", voice: "confident and warm" },
      campaignInformation: { name: "Launch", objective: "Increase awareness", callToAction: "Shop now" },
      targetAudience: "Active urban professionals",
      platform: "instagram",
    });
    await workspace.uploadImage(project.id, {
      fileName: "black-steel-bottle-front-studio.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    const images = new ImageIntelligenceManager();
    await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const products = new ProductIntelligenceManager();
    await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    products.attachImageIntelligence(images);
    const manager = new MarketingIntelligenceManager();
    await manager.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, products, images });
    const profile = await manager.analyze(project.id);
    expect(profile.audience.persona).toContain("urban professionals");
    expect(profile.brand.identity).toBe("KWIZERA");
    expect(profile.ctas).toContain("Shop now");
    expect(profile.platform.format).toContain("vertical");
    expect(profile.sellingPoints).toContain("stainless steel");
    expect(profile.recommendations.length).toBeGreaterThan(1);
    expect(profile.score).toBeGreaterThan(70);
    expect((await manager.analyze(project.id)).cached).toBe(true);
    const restored = new MarketingIntelligenceManager();
    await restored.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, products, images });
    expect((await restored.getDashboard(project.id)).profiles).toHaveLength(1);
  });
});
