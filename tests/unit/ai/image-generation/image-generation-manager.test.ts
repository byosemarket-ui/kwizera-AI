import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageGenerationManager } from "../../../../ai/image-generation/image-generation-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("ImageGenerationManager", () => {
  it("loads an image model and persists cached product-aware marketing image variations", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-images-"));
    roots.push(storageRoot);
    const workspace = new CreativeWorkspaceManager();
    const planning = new CreativePlanningManager();
    const models = new AiModelManager();
    await workspace.initialize(storageRoot);
    await planning.initialize(storageRoot);
    await models.initialize(storageRoot);
    await models.registry.register({ id: "test-image-model", name: "Test Image Model", category: "image", version: "1.0.0", description: "Test model", requirements: { ramMb: 0, storageMb: 0 }, capabilities: ["image-generation"] });

    const project = await workspace.createProject("Image Launch");
    await workspace.updateProject(project.id, { productInformation: { name: "Studio Bottle", category: "Beverage", description: "Reusable insulated bottle" }, brandInformation: { name: "KWIZERA", voice: "confident" }, campaignInformation: { name: "Launch", objective: "Increase awareness", callToAction: "Shop now" }, targetAudience: "Urban professionals" });
    const source = await workspace.uploadImage(project.id, { fileName: "bottle.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });

    const manager = new ImageGenerationManager();
    await manager.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
    const request = { projectId: project.id, prompt: "Luxury studio marketing image for the reusable Studio Bottle", mode: "product-to-image" as const, modelId: "test-image-model", style: "luxury" as const, aspectRatio: "1:1" as const, resolution: "high" as const, count: 2, productImageId: source.id };
    const generated = await manager.generate(request);

    expect(generated).toHaveLength(2);
    expect(generated[0].sourceImageUrl).toContain(source.fileName);
    expect((await fs.readFile((await manager.getAssetPath(generated[0].id))!, "utf8")).toContain("Studio Bottle");
    expect(models.getMutable("test-image-model").status).toBe("loaded");
    expect((await manager.generate(request))[0].cached).toBe(true);
    expect((await manager.getDashboard(project.id)).history).toHaveLength(1);

    const restored = new ImageGenerationManager();
    await restored.initialize(storageRoot, { core: undefined as unknown as AiCoreManager, models, workspace, planning });
    expect((await restored.getDashboard(project.id)).images).toHaveLength(2);
  });
});